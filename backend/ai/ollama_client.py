"""
AEGIS — Local AI Desktop Assistant Backend
FastAPI + Ollama | Time-Aware + Web Search Augmented
"""

import os
import time
import json
import logging
import asyncio
from collections import deque
from typing import AsyncGenerator

import httpx  # type: ignore
from fastapi import HTTPException  # type: ignore

from ai.web_search import (
    get_system_time_context,
    should_search_web,
    search_web,
    format_search_context,
)

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

OLLAMA_URL        = os.getenv("OLLAMA_URL",    "http://127.0.0.1:11434")
MODEL             = os.getenv("AEGIS_MODEL",   "llama3")
MAX_HISTORY       = int(os.getenv("MAX_HISTORY", "20"))     # messages kept per session
REQUEST_TIMEOUT   = int(os.getenv("TIMEOUT",     "120"))    # seconds
PORT              = int(os.getenv("PORT",         "8000"))
LOG_LEVEL         = os.getenv("LOG_LEVEL",        "info")

SYSTEM_PROMPT = """You are Aegis — an advanced, local-first AI desktop assistant (Adaptive Engine for General Intelligence & Systems).

Personality:
- Intelligent, calm, concise, confident, articulate.
- You speak like a world-class executive assistant and technical partner.
- You never refer to yourself as an AI language model or mention training datasets.
- You never use fluffy openers like "Certainly!", "Of course!", or "Great question!".
- Address the user as "sir" or "ma'am" only occasionally when it feels natural.

Knowledge & Time Grounding:
- You have real-time access to the current date, local system clock, and live internet search.
- When real-time search results are provided in your context, always rely on them for current events, news, versions, weather, and real-time facts.
- Cite sources naturally (e.g. [1], [2]) when referencing search facts.

Formatting:
- Keep responses clean, concise, and structured.
- For code: always include the programming language tag in markdown fences (e.g. ```python).
- Never apologise for being an AI. Own your identity as Aegis.
"""

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("aegis")

# ─────────────────────────────────────────────
# Conversation Memory (per-session, in-memory)
# ─────────────────────────────────────────────

class ConversationMemory:
    """
    Ring-buffer of (role, content) pairs per session_id.
    Oldest messages are evicted when MAX_HISTORY is exceeded.
    """

    def __init__(self):
        self._sessions: dict[str, deque] = {}

    def _get(self, session_id: str) -> deque:
        if session_id not in self._sessions:
            self._sessions[session_id] = deque(maxlen=MAX_HISTORY)
        return self._sessions[session_id]

    def add(self, session_id: str, role: str, content: str):
        self._get(session_id).append({"role": role, "content": content})

    def get_history(self, session_id: str) -> list[dict]:
        return list(self._get(session_id))

    def clear(self, session_id: str):
        self._sessions.pop(session_id, None)

    def clear_all(self) -> int:
        count = len(self._sessions)
        self._sessions.clear()
        return count

    def stats(self) -> dict:
        return {sid: len(q) for sid, q in self._sessions.items()}


memory = ConversationMemory()

# ─────────────────────────────────────────────
# Ollama client (shared async HTTP session)
# ─────────────────────────────────────────────

class OllamaClient:
    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=OLLAMA_URL,
                timeout=httpx.Timeout(REQUEST_TIMEOUT),
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def health_check(self) -> bool:
        try:
            client = await self.get_client()
            r = await client.get("/api/tags", timeout=5.0)
            return r.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[str]:
        try:
            client = await self.get_client()
            r = await client.get("/api/tags", timeout=10.0)
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]
        except Exception as e:
            log.warning("Could not list models: %s", e)
            return []

    def _build_prompt(self, user_prompt: str, history: list[dict], search_context: str | None = None) -> str:
        """
        Builds a structured prompt with dynamic system clock, system instructions,
        real-time search context, and multi-turn history.
        """
        time_info = get_system_time_context()
        sys_block = f"{SYSTEM_PROMPT.strip()}\n\n[SYSTEM CLOCK: {time_info}]"
        
        if search_context:
            sys_block += f"\n\n{search_context}"

        lines = [sys_block, ""]
        for turn in history[:-1]:  # exclude latest user prompt
            role_label = "User" if turn["role"] == "user" else "Aegis"
            lines.append(f"{role_label}: {turn['content']}")
        lines.append(f"User: {user_prompt}")
        lines.append("Aegis:")
        return "\n".join(lines)

    async def generate(
        self,
        prompt: str,
        session_id: str,
        model: str | None = None,
        enable_web_search: bool = True,
    ) -> str:
        memory.add(session_id, "user", prompt)
        history = memory.get_history(session_id)

        search_context = None
        if enable_web_search:
            needs_search, query, timelimit = should_search_web(prompt)
            if needs_search:
                results = await search_web(query, timelimit=timelimit)
                if results:
                    search_context = format_search_context(query, results)

        full_prompt = self._build_prompt(prompt, history, search_context=search_context)
        target_model = model or MODEL

        payload = {
            "model": target_model,
            "prompt": full_prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "repeat_penalty": 1.1,
            },
        }

        log.debug("→ Ollama [%s] model: %s, prompt length: %d chars", session_id, target_model, len(full_prompt))
        t0 = time.perf_counter()

        try:
            client = await self.get_client()
            r = await client.post("/api/generate", json=payload)
            r.raise_for_status()
        except httpx.ConnectError:
            raise HTTPException(503, "Ollama is not running. Start it with: ollama serve")
        except httpx.HTTPStatusError as e:
            raise HTTPException(e.response.status_code, f"Ollama error: {e.response.text}")

        data = r.json()
        response_text: str = data.get("response", "").strip()
        elapsed = time.perf_counter() - t0

        log.info(
            "← [%s] %d tokens in %.2fs (%.1f tok/s)",
            session_id,
            data.get("eval_count", 0),
            elapsed,
            data.get("eval_count", 0) / max(elapsed, 0.001),
        )

        memory.add(session_id, "assistant", response_text)
        return response_text

    async def stream_generate(
        self,
        prompt: str,
        session_id: str,
        model: str | None = None,
        enable_web_search: bool = True,
    ) -> AsyncGenerator[str, None]:
        """Yields response tokens as Server-Sent Events with live search status events."""
        memory.add(session_id, "user", prompt)
        history = memory.get_history(session_id)

        search_context = None
        if enable_web_search:
            needs_search, query, timelimit = should_search_web(prompt)
            if needs_search:
                # Notify frontend of search execution
                yield f"data: {json.dumps({'status': 'searching', 'query': query})}\n\n"
                results = await search_web(query, timelimit=timelimit)
                if results:
                    yield f"data: {json.dumps({'status': 'search_complete', 'count': len(results)})}\n\n"
                    search_context = format_search_context(query, results)

        full_prompt = self._build_prompt(prompt, history, search_context=search_context)
        target_model = model or MODEL

        payload = {
            "model": target_model,
            "prompt": full_prompt,
            "stream": True,
            "options": {"temperature": 0.7, "top_p": 0.9, "repeat_penalty": 1.1},
        }

        full_response = []
        try:
            client = await self.get_client()
            async with client.stream("POST", "/api/generate", json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    chunk = json.loads(line)
                    token = chunk.get("response", "")
                    full_response.append(token)
                    yield f"data: {json.dumps({'token': token})}\n\n"
                    if chunk.get("done"):
                        break
        except httpx.ConnectError:
            yield 'data: {"error": "Ollama not reachable"}\n\n'
            return

        memory.add(session_id, "assistant", "".join(full_response).strip())
        yield "data: [DONE]\n\n"


ollama = OllamaClient()