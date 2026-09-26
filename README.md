# Aegis — Local-First AI Desktop Assistant

> **A privacy-first, local AI desktop assistant inspired by J.A.R.V.I.S.**

Aegis runs entirely on your local machine using **Ollama** for large language models and **Faster-Whisper** for speech recognition. All conversation data, processing, and voice transcription stay private and offline.

---

## Features

- **Real-Time Streaming**: Low-latency token-by-token response streaming via Server-Sent Events (SSE).
- **Voice-to-Text Pipeline**: Offline transcription using **Faster-Whisper** (`int8` CPU quantization).
- **Text-to-Speech (TTS)**: Built-in voice synthesis playback for hands-free conversations.
- **Custom Markdown & Code Blocks**: Rich formatting with inline rendering, syntax highlighting, and one-click code copying.
- **Dynamic Model Selection**: Connects directly to local Ollama instance with model switching on the fly.
- **Persistent Conversation Memory**: Local multi-turn session history with instant search and clear capabilities.
- **Modern Desktop UI**: Futuristic dark interface crafted with Electron, React 19, and TypeScript.

---

## Architecture

```
Aegis/
├── backend/
│   ├── ai/
│   │   ├── ollama_client.py     # Ollama API client & conversation memory
│   │   └── whisper_client.py    # Faster-Whisper lazy-loaded model & transcription
│   └── main.py                  # FastAPI server & route handlers
└── frontend/
    ├── src/
    │   ├── App.tsx              # React desktop UI, SSE stream consumer, voice controls
    │   ├── main.ts              # Electron main process
    │   ├── preload.ts           # Electron preload bridge
    │   └── renderer.tsx         # React root renderer
    └── package.json
```

```
Microphone  ──>  MediaRecorder  ──>  Audio Blob  ──>  POST /voice/transcribe
                                                              │
                                                        Faster-Whisper
                                                              │
Aegis UI  <──  SSE Token Stream  <──  Ollama LLM  <──  sendMessage(text)
   │
SpeechSynthesis (TTS)
```

---

## Getting Started

### Prerequisites

1. **Node.js** (v18+ recommended)
2. **Python** (3.10+ recommended)
3. **Ollama**: [ollama.ai](https://ollama.ai) installed and running locally.
   ```bash
   ollama pull llama3
   ```

### 1. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt  # or install fastapi uvicorn httpx pydantic faster-whisper
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

---

## Roadmap

- [x] Phase 1 & 2: Core Assistant, SSE Streaming & Faster-Whisper Voice Pipeline
- [ ] Phase 3: Wake-word activation ("Hey Aegis") & Continuous listening mode
- [ ] Phase 4: Long-term persistent memory & Semantic retrieval
- [x] Phase 5: Safe desktop tool execution & PC controls (Volume, Media, App Orchestration, Hardware Telemetry, File Search, PowerShell Runner)
- [ ] Phase 6: Vision & Local screenshot analysis
- [ ] Phase 7: Multi-step agent planning & autonomous execution
- [ ] Phase 8: Modular plugin and skill ecosystem

---

## License

MIT
