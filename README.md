# Aegis — Adaptive Engine for General Intelligence & Systems

> **A privacy-first, local-first AI desktop assistant with a Holographic User Interface.**

Aegis runs entirely on your local machine using **Ollama** for large language models, **Faster-Whisper** for offline speech recognition, and native system automation for deep host PC control. All conversation data, processing, and voice transcription stay private and offline.

---

## 🌟 Key Features

### 1. Holographic HUD & Tactical Chat Console
- **Central Core (Orb)**: 50% screen scale volumetric 3D crystal-glass orb with Fresnel specular highlights, 28 living sinusoidal filaments, and an explosive command-ingestion puff expansion.
- **Differential Concentric Data Rings**: 3 concentric orbital rings (Outer 5s, Middle 12s, Inner 24s) with chevron framing brackets, sensor tick marks, and dynamic compute acceleration.
- **Tactical 3D Glassmorphic Quadrants**: 4 floating perspective panels for Neural Diagnostics, Acoustic VAD, Real-Time Hardware Telemetry (CPU/RAM/Battery), and 360° Radar sweeps.
- **Stark Tactical Command Console**: High-tech chat timeline with docked ambient Arc Reactor, rich syntax-highlighted code blocks, one-click copy/speak, quick action chips, and zero-flicker transcription.
- **Dual View Modes**: Switch instantly between the **Holographic HUD** and **Tactical Command Console** with `Tab`.

### 2. Voice & Audio Architecture
- **Procedural Web Audio Drone**: Zero-latency dual-oscillator 110Hz + 220Hz harmonic drone that dynamically ramps during neural computation.
- **Stark Sound Synthesizer**: Procedural acoustic cues including ascending 3-tone arpeggios (`520Hz -> 680Hz -> 840Hz`) on successful PC command executions and instant cutoff ticks on barge-in.
- **Offline Speech-to-Text**: Low-latency voice transcription via **Faster-Whisper** (`int8` CPU quantization).
- **High-Velocity Speech Synthesis**: Ultra-responsive TTS configured for 1.70x speed with real-time micro-clause streaming.
- **Zero-Latency Barge-In**: Real-time Voice Activity Detection (VAD) instantly silences speech and halts streaming when you speak.

### 3. Deep Host PC Control & Safe System Automation
- **System Audio**: Set volume levels, mute, and unmute.
- **Media Controls**: Play, pause, skip, and rewind media players.
- **Application Orchestration**: Launch and focus applications (Spotify, VS Code, Browser, Notepad, etc.).
- **Real-Time Hardware Telemetry**: Live CPU load, RAM usage, battery state, and host uptime.
- **File System Operations**: Recursive search across Documents, Downloads, Desktop, and user libraries.
- **PowerShell Runner**: Safe command-line automation for desktop control.

---

## 🏛️ System Architecture

```
Aegis/
├── backend/
│   ├── ai/
│   │   ├── ollama_client.py     # Ollama streaming client & conversation memory
│   │   ├── whisper_client.py    # Faster-Whisper lazy-loaded model & transcription
│   │   └── pc_tools.py          # Windows PC automation & hardware telemetry
│   └── main.py                  # FastAPI server & Server-Sent Events (SSE)
├── docs/
│   └── AEGIS_UI_SPECIFICATION.md# Full 5-component holographic UI architecture spec
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── AegisCore.tsx        # 50% scale crystal orb & differential data rings
    │   │   ├── AegisHudView.tsx     # Master holographic viewport & floating transcripts
    │   │   ├── AegisChatConsole.tsx # Stark tactical command console with docked Arc Reactor
    │   │   └── HudTelemetry.tsx     # 4 tactical glassmorphic telemetry quadrants
    │   ├── voiceController.ts       # VAD, TTS & AegisHarmonicSynthesizer drone
    │   ├── App.tsx                  # View switcher, keyboard shortcuts & state sync
    │   ├── main.ts              # Electron main process
    │   ├── preload.ts           # Electron preload bridge
    │   └── renderer.tsx         # React 19 root
    └── package.json
```

```
Microphone  ──>  MediaRecorder  ──>  POST /voice/transcribe  ──>  Faster-Whisper
                                                                        │
Aegis HUD   <──  SSE Token Stream <──  Ollama LLM (llama3)  <──  sendMessage()
    │                                           │
Web Audio (Drone & Chimes)               Local PC Automation
                                         (Volume / Apps / Shell)
```

---

## ⚡ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Tab` | Toggle between Holographic HUD & Tactical Command Terminal |
| `Ctrl + M` | Toggle Continuous Hands-Free Voice Mode |
| `Esc` | Instant Interrupt / Barge-In (Abort speech and computation) |
| `Enter` | Send message in terminal |
| `Ctrl + L` | Clear conversation history |

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js** (v18+ recommended)
2. **Python** (3.10+ recommended)
3. **Ollama**: [ollama.ai](https://ollama.ai) installed and running locally with `llama3`:
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

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

---

## 🗺️ Roadmap

- [x] **Phase 1 & 2**: Core Assistant, SSE Streaming & Faster-Whisper Voice Pipeline
- [x] **Phase 3**: Holographic HUD View, Crystal Arc Reactor Core & Concentric Data Rings
- [x] **Phase 4**: Procedural Web Audio Synthesizer, 110Hz/220Hz Drone & Zero-Latency Barge-In
- [x] **Phase 5**: Safe Desktop Tool Execution & Host PC Controls (Volume, Media, App Orchestration, Telemetry)
- [ ] **Phase 6**: Offline Wake-word activation ("Hey Aegis") & Continuous ambient listening
- [ ] **Phase 7**: Vision & Local screenshot analysis
- [ ] **Phase 8**: Autonomous multi-step agent planning

---

## 📄 License

MIT
