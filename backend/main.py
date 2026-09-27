"""
Aegis — FastAPI Application Entry Point
"""

import time
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, Query, Depends, UploadFile, File  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from fastapi.middleware.gzip import GZipMiddleware  # type: ignore
from fastapi.responses import StreamingResponse, JSONResponse  # type: ignore

from pydantic import BaseModel, Field  # type: ignore

from ai.ollama_client import ollama, memory, MODEL
from ai.whisper_client import transcribe
from ai import pc_controller
from ai.tools import execute_tool
import tempfile
import os


log = logging.getLogger("aegis.app")

# ─────────────────────────────────────────────────────────────
# Request / Response models
# ─────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=8000, description="User message")
    session_id: str = Field(default="default", min_length=1, max_length=64)
    model: str | None = Field(default=None, description="Optional model override")
    web_search: bool = Field(default=True, description="Enable real-time internet search augmentation")
    tools: bool = Field(default=True, description="Enable native PC control tools")

class ToolExecutionRequest(BaseModel):
    tool: str
    args: dict = Field(default_factory=dict)

class AskResponse(BaseModel):
    response: str
    session_id: str
    model: str

# ─────────────────────────────────────────────────────────────
# Lifespan — startup / shutdown
# ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("═══ Aegis starting — model: %s ═══", MODEL)

    alive = await ollama.health_check()
    if alive:
        models = await ollama.list_models()
        log.info("✓ Ollama reachable  |  models: %s", models or "(none pulled)")
        if not any(MODEL in m for m in (models or [])):
            log.warning("Model '%s' not found locally → run: ollama pull %s", MODEL, MODEL)
        else:
            # Pre-warm model in VRAM in background so first user request is instant
            asyncio.create_task(ollama.warmup(MODEL))
    else:
        log.warning("✗ Ollama unreachable — requests will fail until it's running")

    yield  # ← app is live here

    await ollama.close()
    log.info("═══ Aegis stopped ═══")


# ─────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Aegis AI",
    description="Local AI desktop assistant — powered by Ollama",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─────────────────────────────────────────────────────────────
# Middleware
# ─────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev
        "http://localhost:3000",   # CRA / other
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=500)


@app.middleware("http")
async def request_timing(request: Request, call_next):
    """Attach X-Response-Time to every response."""
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    response.headers["X-Response-Time"] = f"{ms:.1f}ms"
    return response


@app.middleware("http")
async def catch_unhandled(request: Request, call_next):
    """Convert unhandled exceptions into clean JSON 500s."""
    try:
        return await call_next(request)
    except Exception as exc:
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "type": type(exc).__name__},
        )


# ─────────────────────────────────────────────────────────────
# Dependencies
# ─────────────────────────────────────────────────────────────

def validate_prompt(
    prompt: str = Query(..., min_length=1, max_length=8000, description="User message"),
) -> str:
    return prompt.strip()

def validate_session(
    session_id: str = Query(default="default", min_length=1, max_length=64),
) -> str:
    return session_id.strip()


# ─────────────────────────────────────────────────────────────
# Routes — system
# ─────────────────────────────────────────────────────────────

@app.get("/", tags=["system"], summary="Root ping")
async def root():
    return {"name": "Aegis", "version": "2.0.0", "status": "running", "docs": "/docs"}


@app.get("/health", tags=["system"], summary="Backend + Ollama health check")
async def health():
    """
    Returns Ollama reachability, active model, and per-session memory stats.
    Polled by the frontend every 15 s to update the status indicator.
    """
    ollama_alive = await ollama.health_check()
    return {
        "status": "ok",
        "ollama": ollama_alive,
        "model": MODEL,
        "sessions": memory.stats(),
    }


@app.get("/models", tags=["system"], summary="List available Ollama models")
async def list_models():
    """Returns all models pulled locally and which one is currently active."""
    models = await ollama.list_models()
    return {"models": models, "active": MODEL}


# ─────────────────────────────────────────────────────────────
# Routes — chat
# ─────────────────────────────────────────────────────────────

@app.get("/ask", response_model=AskResponse, tags=["chat"], summary="Single-shot response (GET, backward-compat)")
async def ask_get(
    prompt: str = Depends(validate_prompt),
    session_id: str = Depends(validate_session),
    model: str | None = Query(default=None, description="Optional model override"),
    web_search: bool = Query(default=True, description="Enable web search"),
    tools: bool = Query(default=True, description="Enable PC control tools"),
):
    """
    Kept for backward compatibility with the original frontend.
    For new integrations prefer POST /ask or GET /ask/stream.
    """
    active_model = model or MODEL
    response_text = await ollama.generate(
        prompt,
        session_id,
        model=active_model,
        enable_web_search=web_search,
        enable_tools=tools,
    )
    return AskResponse(
        response=response_text,
        session_id=session_id,
        model=active_model,
    )


@app.post("/ask", response_model=AskResponse, tags=["chat"], summary="Single-shot response (POST)")
async def ask_post(body: AskRequest):
    """POST endpoint with JSON body."""
    active_model = body.model or MODEL
    response_text = await ollama.generate(
        body.prompt,
        body.session_id,
        model=active_model,
        enable_web_search=body.web_search,
        enable_tools=body.tools,
    )
    return AskResponse(
        response=response_text,
        session_id=body.session_id,
        model=active_model,
    )


@app.get(
    "/ask/stream",
    tags=["chat"],
    summary="Streaming response via Server-Sent Events",
    response_class=StreamingResponse,
)
async def ask_stream(
    prompt: str = Depends(validate_prompt),
    session_id: str = Depends(validate_session),
    model: str | None = Query(default=None, description="Optional model override"),
    web_search: bool = Query(default=True, description="Enable web search"),
    tools: bool = Query(default=True, description="Enable PC control tools"),
):
    """
    Streams response tokens as Server-Sent Events with live PC action and web search events.

    Event format:
      `data: {"status": "action", "tool": "...", "detail": "..."}`
      `data: {"status": "searching", "query": "..."}`
      `data: {"token": "..."}`
    Final event:
      `data: [DONE]`
    Error event:
      `data: {"error": "..."}`
    """
    return StreamingResponse(
        ollama.stream_generate(
            prompt, session_id, model=model, enable_web_search=web_search, enable_tools=tools
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",       # disables Nginx buffering
            "Connection":        "keep-alive",
        },
    )


# ─────────────────────────────────────────────────────────────
# Routes — PC Controller & Hardware Telemetry
# ─────────────────────────────────────────────────────────────

@app.get("/system/telemetry", tags=["system"], summary="Get host PC hardware telemetry")
async def system_telemetry():
    """Returns real-time CPU, RAM, Battery, Disk and OS telemetry."""
    return pc_controller.get_system_telemetry()


@app.get("/system/volume", tags=["system"], summary="Get current master audio volume")
async def system_volume():
    """Returns current volume percentage and mute status."""
    return pc_controller.get_volume()


@app.post("/system/execute", tags=["system"], summary="Directly execute a PC action")
async def system_execute(body: ToolExecutionRequest):
    """Directly dispatches a PC control tool action."""
    return execute_tool(body.tool, body.args)


# ─────────────────────────────────────────────────────────────
# Routes — memory
# ─────────────────────────────────────────────────────────────

@app.get("/history/{session_id}", tags=["memory"], summary="Fetch conversation history")
async def get_history(session_id: str):
    """Returns the stored message history for a session (for debugging / UI restore)."""
    hist = memory.get_history(session_id)
    if not hist:
        raise HTTPException(status_code=404, detail=f"No history found for session '{session_id}'")
    return {"session_id": session_id, "messages": hist, "count": len(hist)}


@app.delete("/history/{session_id}", tags=["memory"], summary="Clear a session's memory")
async def clear_history(session_id: str):
    """Wipes all conversation history for the given session."""
    memory.clear(session_id)
    log.info("Cleared history for session: %s", session_id)
    return {"cleared": True, "session_id": session_id}


@app.delete("/history", tags=["memory"], summary="Clear ALL sessions")
async def clear_all_history():
    """Nuclear option — wipes memory for every active session."""
    count = memory.clear_all()
    log.warning("Cleared ALL sessions (%d)", count)
    return {"cleared": True, "sessions_removed": count}


@app.post("/voice/transcribe", tags=["voice"], summary="Transcribe audio file via Faster-Whisper")
async def voice_transcribe(file: UploadFile = File(...)):
    raw_name = file.filename or "recording.webm"
    suffix = os.path.splitext(raw_name)[1] or ".webm"

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=suffix
    ) as temp:
        temp.write(await file.read())
        temp_path = temp.name

    try:
        text = transcribe(temp_path)
        return {
            "text": text
        }
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass