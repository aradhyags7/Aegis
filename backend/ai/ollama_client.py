"""
Aegis — Local AI Desktop Assistant Backend
FastAPI + Ollama | Production-grade
"""

import os
import time
import logging
import asyncio
from contextlib import asynccontextmanager
from collections import deque
from typing import AsyncGenerator

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

OLLAMA_URL        = os.getenv("OLLAMA_URL",    "http://127.0.0.1:11434")
MODEL             = os.getenv("AEGIS_MODEL",   "llama3")
MAX_HISTORY       = int(os.getenv("MAX_HISTORY", "20"))     # messages kept per session
REQUEST_TIMEOUT   = int(os.getenv("TIMEOUT",     "120"))    # seconds
PORT              = int(os.getenv("PORT",         "8000"))
LOG_LEVEL         = os.getenv("LOG_LEVEL",        "info")

SYSTEM_PROMPT = """You are Aegis — a futuristic AI desktop assistant inspired by J.A.R.V.I.S.

Personality:
- Intelligent, calm, concise, confident, slightly witty.
- You speak like a real assistant, not a chatbot.
- You never refer to yourself as an AI language model or mention your training.
- You never say "Certainly!", "Of course!", "Great question!" or similar filler openers.
- Address the user as "sir" or "ma'am" only when it feels natural — never excessively.

Rules:
- Keep answers short and precise unless the user asks for depth.
- Prefer bullet points only when listing truly enumerable items.
- For code: always include language tags in markdown fences.
- Never apologise for being an AI. Own your identity as Aegis.
- If you don't know something, say so directly without deflection.
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

    def _build_prompt(self, user_prompt: str, history: list[dict]) -> str:
        """
        Builds a structured prompt that includes the system instruction
        and rolling conversation history for models that don't support
        native multi-turn chat (Ollama /api/generate endpoint).
        """
        lines = [SYSTEM_PROMPT.strip(), ""]
        for turn in history[:-1]:           # exclude the latest (already added below)
            role_label = "User" if turn["role"] == "user" else "Aegis"
            lines.append(f"{role_label}: {turn['content']}")
        lines.append(f"User: {user_prompt}")
        lines.append("Aegis:")
        return "\n".join(lines)

    async def generate(self, prompt: str, session_id: str, model: str | None = None) -> str:
        memory.add(session_id, "user", prompt)
        history = memory.get_history(session_id)
        full_prompt = self._build_prompt(prompt, history)
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
        self, prompt: str, session_id: str, model: str | None = None
    ) -> AsyncGenerator[str, None]:
        """Yields response tokens as Server-Sent Events."""
        memory.add(session_id, "user", prompt)
        history = memory.get_history(session_id)
        full_prompt = self._build_prompt(prompt, history)
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
                    import json as _json
                    chunk = _json.loads(line)
                    token = chunk.get("response", "")
                    full_response.append(token)
                    yield f"data: {_json.dumps({'token': token})}\n\n"
                    if chunk.get("done"):
                        break
        except httpx.ConnectError:
            yield 'data: {"error": "Ollama not reachable"}\n\n'
            return

        memory.add(session_id, "assistant", "".join(full_response).strip())
        yield "data: [DONE]\n\n"


ollama = OllamaClient()

# ─────────────────────────────────────────────
# App lifecycle
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Aegis starting — model: %s | history: %d", MODEL, MAX_HISTORY)
    if await ollama.health_check():
        models = await ollama.list_models()
        log.info("Ollama ✓  available models: %s", models or "(none pulled yet)")
        if MODEL not in (models or []):
            log.warning("Model '%s' not found locally. Run: ollama pull %s", MODEL, MODEL)
    else:
        log.warning("Ollama unreachable at %s — start it before making requests.", OLLAMA_URL)
    yield
    await ollama.close()
    log.info("Aegis stopped.")


# ─────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────

app = FastAPI(
    title="Aegis AI",
    description="Local AI desktop assistant backend",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Request / Response models
# ─────────────────────────────────────────────

class AskRequest(BaseModel):
    prompt: str       = Field(..., min_length=1, max_length=8000)
    session_id: str   = Field(default="default")

class AskResponse(BaseModel):
    response: str
    session_id: str
    model: str

class HealthResponse(BaseModel):
    status: str
    ollama: bool
    model: str
    sessions: dict

# ─────────────────────────────────────────────
# Middleware — request timing
# ─────────────────────────────────────────────

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    response.headers["X-Response-Time"] = f"{ms:.1f}ms"
    return response

# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health():
    """Check Ollama connectivity and session stats."""
    return HealthResponse(
        status="ok",
        ollama=await ollama.health_check(),
        model=MODEL,
        sessions=memory.stats(),
    )


@app.get("/ask", response_model=AskResponse, tags=["chat"])
async def ask_get(
    prompt:     str = Query(..., min_length=1, max_length=8000),
    session_id: str = Query(default="default"),
):
    """
    Simple GET endpoint — compatible with the existing React frontend.
    For new integrations prefer POST /ask.
    """
    response_text = await ollama.generate(prompt, session_id)
    return AskResponse(response=response_text, session_id=session_id, model=MODEL)


@app.post("/ask", response_model=AskResponse, tags=["chat"])
async def ask_post(body: AskRequest):
    """POST endpoint with JSON body — preferred for production use."""
    response_text = await ollama.generate(body.prompt, body.session_id)
    return AskResponse(response=response_text, session_id=body.session_id, model=MODEL)


@app.get("/ask/stream", tags=["chat"])
async def ask_stream(
    prompt:     str = Query(..., min_length=1, max_length=8000),
    session_id: str = Query(default="default"),
):
    """
    Server-Sent Events stream.
    Each event: `data: {"token": "..."}`
    Final event: `data: [DONE]`
    """
    return StreamingResponse(
        ollama.stream_generate(prompt, session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.delete("/history/{session_id}", tags=["chat"])
async def clear_history(session_id: str):
    """Wipe conversation memory for a session."""
    memory.clear(session_id)
    log.info("Cleared history for session: %s", session_id)
    return {"cleared": session_id}


@app.get("/models", tags=["system"])
async def list_models():
    """List all models available in Ollama."""
    models = await ollama.list_models()
    return {"models": models, "active": MODEL}


@app.get("/", include_in_schema=False)
async def root():
    return JSONResponse({"name": "Aegis", "version": "2.0.0", "docs": "/docs"})


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=PORT,
        reload=True,
        log_level=LOG_LEVEL,
    )