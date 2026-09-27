/**
 * AEGIS — Adaptive Engine for General Intelligence & Systems
 *
 * Capabilities:
 *  ✦ Dual View Architecture:
 *      1. Holographic HUD Mode (Arc Reactor Core, live real-time speech subtitles, audio telemetry)
 *      2. Tactical Command Terminal (Glassmorphic chat, syntax-highlighted code, markdown)
 *  ✦ Real-time Live Speech-to-Text Transcription displayed while speaking
 *  ✦ Real-time Time-Aware Internet Web Search & Source Citations
 *  ✦ Dynamic Dark / Light Themes (Cosmic Obsidian & Titanium Stark White)
 *  ✦ Interactive Sound-Reactive Arc Reactor with Click Shockwaves & Orbiting Nodes
 *  ✦ Real-time Voice Activity Detection (VAD) & Silence Auto-Stop (~1.3s)
 *  ✦ Zero-Latency Barge-In Interruption Engine
 *  ✦ Local Faster-Whisper Transcription & Ollama SSE Streaming
 *  ✦ Local SpeechSynthesis TTS with markdown stripping
 *  ✦ Keyboard Shortcuts: Tab=Toggle HUD/Terminal, Enter=Send, Esc=Abort/Interrupt, Ctrl+M=Voice Mode, Ctrl+L=Clear
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  VoiceState,
  TTSController,
  VADEngine,
  playAudioCue,
  AegisHarmonicSynthesizer,
} from "./voiceController";

import { AegisHudView } from "./components/AegisHudView";
import { AegisChatConsole } from "./components/AegisChatConsole";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: number;
  streaming?: boolean;
}

type BackendStatus = "checking" | "online" | "offline";
type ViewMode = "HUD" | "TERMINAL";
type ThemeMode = "dark" | "light";

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function getSessionId(): string {
  let id = localStorage.getItem("aegis_session");
  if (!id) {
    id = uuid();
    localStorage.setItem("aegis_session", id);
  }
  return id;
}

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem("aegis_chat");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(msgs: Message[]) {
  localStorage.setItem("aegis_chat", JSON.stringify(msgs.slice(-100)));
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────────────────
// Main App Component
// ─────────────────────────────────────────────────────────

const SESSION_ID = getSessionId();
const BASE = "http://127.0.0.1:8000";

export default function App() {
  // ── Theme State: "dark" | "light" ────────────────────
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem("aegis_theme") as ThemeMode) || "dark";
  });

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("aegis_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  // ── View Mode: HUD vs TERMINAL ───────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("HUD");

  const [message, setMessage]                   = useState("");
  const [chat, setChat]                         = useState<Message[]>(loadHistory);
  const [loading, setLoading]                   = useState(false);
  const [streaming, setStreaming]               = useState(false);
  const [searchStatus, setSearchStatus]         = useState<string | null>(null);
  const [actionStatus, setActionStatus]         = useState<string | null>(null);
  const [status, setStatus]                     = useState<BackendStatus>("checking");
  const [models, setModels]                     = useState<string[]>([]);
  const [activeModel, setActiveModel]           = useState("llama3");
  const [copied, setCopied]                     = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ── Phase 3: Advanced Voice Interaction State ────────
  const [voiceMode, setVoiceMode]               = useState(false);
  const [voiceState, setVoiceState]             = useState<VoiceState>("IDLE");
  const [audioEnergy, setAudioEnergy]           = useState(0);
  const [liveTranscript, setLiveTranscript]     = useState("");
  const [audioCuesEnabled, setAudioCuesEnabled] = useState(() => {
    return localStorage.getItem("aegis_audio_cues") !== "false";
  });
  const [voiceError, setVoiceError]             = useState<string | null>(null);

  // Refs for zero-latency access
  const voiceStateRef       = useRef<VoiceState>("IDLE");
  const voiceModeRef        = useRef(false);
  const audioCuesEnabledRef = useRef(audioCuesEnabled);
  const ttsRef              = useRef<TTSController>(new TTSController());
  const vadRef              = useRef<VADEngine>(new VADEngine());
  const recognitionRef      = useRef<any>(null);
  const synthRef            = useRef<AegisHarmonicSynthesizer>(new AegisHarmonicSynthesizer());

  // Speech Rate State (Default 1.7x Very Fast)
  const [speechRate, setSpeechRate] = useState<number>(() => ttsRef.current.getRate());

  const cycleSpeechRate = useCallback(() => {
    setSpeechRate(prev => {
      let next = 1.7;
      if (prev < 1.35) next = 1.5;
      else if (prev < 1.6) next = 1.75;
      else if (prev < 1.85) next = 2.0;
      else next = 1.2;
      ttsRef.current.setRate(next);
      return next;
    });
  }, []);

  const chatEndRef        = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLTextAreaElement>(null);
  const esRef             = useRef<EventSource | null>(null);
  const atBottomRef       = useRef(true);
  const scrollRef         = useRef<HTMLDivElement>(null);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const mediaStreamRef    = useRef<MediaStream | null>(null);

  // Sync refs
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => {
    audioCuesEnabledRef.current = audioCuesEnabled;
    localStorage.setItem("aegis_audio_cues", audioCuesEnabled ? "true" : "false");
  }, [audioCuesEnabled]);

  // Procedural 110Hz + 220Hz Harmonic Ambient Drone Lifecycle
  useEffect(() => {
    if (voiceMode && audioCuesEnabled) {
      synthRef.current.start(true);
    } else {
      synthRef.current.stop();
    }
    return () => {
      synthRef.current.stop();
    };
  }, [voiceMode, audioCuesEnabled]);

  // Modulate ambient drone presence according to cognitive and compute load
  useEffect(() => {
    if (voiceState === "THINKING" || voiceState === "TRANSCRIBING") {
      synthRef.current.setIntensity(1.0); // Elevate drone presence during neural computation
    } else if (voiceState === "SPEAKING") {
      synthRef.current.setIntensity(0.35);
    } else {
      synthRef.current.setIntensity(0.08); // Subtle background hum
    }
  }, [voiceState]);

  // Persist chat
  useEffect(() => { saveHistory(chat.filter(m => !m.streaming)); }, [chat]);

  // Health polling
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
        if (r.ok) {
          const d = await r.json();
          setStatus(d.ollama ? "online" : "offline");
        } else {
          setStatus("offline");
        }
      } catch {
        setStatus("offline");
      }
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);

  // Fetch models
  useEffect(() => {
    fetch(`${BASE}/models`)
      .then(r => r.json())
      .then(d => {
        if (d.models?.length) {
          setModels(d.models);
          setActiveModel(d.active ?? d.models[0]);
        }
      })
      .catch(() => {});
  }, [status]);

  // Smart auto-scroll
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  useLayoutEffect(() => {
    if (atBottomRef.current && viewMode === "TERMINAL") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat, loading, viewMode]);

  // State Transition Helper
  const updateVoiceState = useCallback((nextState: VoiceState, errorMsg?: string) => {
    voiceStateRef.current = nextState;
    setVoiceState(nextState);
    if (nextState === "ERROR") {
      setVoiceError(errorMsg || "Voice error encountered.");
    } else if (errorMsg === undefined) {
      setVoiceError(null);
    }
  }, []);

  // Live Speech Recognition Helper (Disabled in Electron to prevent interim crash/restart loop and flickering)
  const startLiveSpeechRecognition = useCallback(() => {
    // Faster-Whisper local engine handles 100% of speech transcription with zero latency
  }, []);

  const stopLiveSpeechRecognition = useCallback(() => {
    // No-op
  }, []);

  // Abort Stream & TTS
  const abort = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    stopLiveSpeechRecognition();
    ttsRef.current.cancel();
    setSearchStatus(null);
    setActionStatus(null);
    setLoading(false);
    setStreaming(false);
    setChat(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
    if (voiceModeRef.current) {
      updateVoiceState("LISTENING");
    } else {
      updateVoiceState("IDLE");
    }
  }, [updateVoiceState, stopLiveSpeechRecognition]);

  // Clean stream
  const cleanupStream = useCallback(() => {
    stopLiveSpeechRecognition();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  }, [stopLiveSpeechRecognition]);

  const pickMimeType = (): string => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (const type of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) {
        return type;
      }
    }
    return "";
  };

  // Send message
  const sendMessage = useCallback(async (text?: string, fromVoice = false) => {
    const userMessage = (text ?? message).trim();
    if (!userMessage || loading || streaming) return;

    // Voice Speed Command Recognition
    const lower = userMessage.toLowerCase();
    if (lower.includes("speak faster") || lower.includes("talk faster") || lower.includes("speed up") || lower.includes("faster voice") || lower.includes("make very fast") || lower.includes("speak very fast")) {
      const nextRate = 1.85;
      ttsRef.current.setRate(nextRate);
      setSpeechRate(nextRate);
    } else if (lower.includes("speak slower") || lower.includes("talk slower") || lower.includes("slow down")) {
      const nextRate = 1.25;
      ttsRef.current.setRate(nextRate);
      setSpeechRate(nextRate);
    }

    const userMsg: Message = {
      id: uuid(),
      sender: "user",
      text: userMessage,
      timestamp: Date.now(),
    };
    const aiId = uuid();

    setChat(prev => [...prev, userMsg]);
    setMessage("");
    setLoading(true);
    setSearchStatus(null);
    setActionStatus(null);
    atBottomRef.current = true;
    updateVoiceState("THINKING");

    if (inputRef.current) inputRef.current.style.height = "auto";

    const url = `${BASE}/ask/stream?prompt=${encodeURIComponent(userMessage)}&session_id=${SESSION_ID}&model=${encodeURIComponent(activeModel)}`;
    const es = new EventSource(url);
    esRef.current = es;

    let buffer = "";
    let gotFirstToken = false;
    let spokenUpToIndex = 0;

    es.onmessage = (event) => {
      if (event.data === "[DONE]") {
        es.close();
        esRef.current = null;
        setStreaming(false);
        setLoading(false);
        setSearchStatus(null);
        setChat(prev => prev.map(m => m.id === aiId ? { ...m, streaming: false } : m));

        const shouldSpeak = fromVoice || voiceModeRef.current;
        if (shouldSpeak) {
          const remaining = buffer.slice(spokenUpToIndex).trim();
          if (remaining.length > 0) {
            updateVoiceState("SPEAKING");
            ttsRef.current.enqueueSentence(remaining);
          }
          ttsRef.current.markStreamComplete(() => {
            if (voiceModeRef.current) {
              updateVoiceState("LISTENING");
            } else {
              updateVoiceState("IDLE");
            }
          });
        } else {
          if (voiceModeRef.current) updateVoiceState("LISTENING");
          else updateVoiceState("IDLE");
        }
        return;
      }

      try {
        const parsed = JSON.parse(event.data);
        if (parsed.error) {
          es.close();
          setStreaming(false);
          setLoading(false);
          setSearchStatus(null);
          setActionStatus(null);
          ttsRef.current.cancel();
          setChat(prev => prev.map(m => m.id === aiId ? {
            ...m, text: `⚠ ${parsed.error}`, streaming: false
          } : m));
          if (voiceModeRef.current) updateVoiceState("LISTENING");
          else updateVoiceState("IDLE");
          return;
        }

        // Live PC Action Events
        if (parsed.status === "action") {
          setActionStatus(`${parsed.tool}: ${parsed.detail || "Executing..."}`);
          return;
        }
        if (parsed.status === "action_complete") {
          setActionStatus(`${parsed.tool} ✓ ${parsed.result || "Done"}`);
          playAudioCue("command_success", audioCuesEnabledRef.current);
          setTimeout(() => setActionStatus(null), 3500);
          return;
        }

        // Live Web Search Events
        if (parsed.status === "searching") {
          setSearchStatus(`Searching web for: "${parsed.query}"…`);
          return;
        }
        if (parsed.status === "search_complete") {
          setSearchStatus(null);
          return;
        }

        if (parsed.token !== undefined) {
          buffer += parsed.token;
          setSearchStatus(null);

          if (!gotFirstToken) {
            gotFirstToken = true;
            setLoading(false);
            setStreaming(true);
            setChat(prev => [...prev, { id: aiId, sender: "ai", text: buffer, timestamp: Date.now(), streaming: true }]);
          } else {
            setChat(prev => prev.map(m => m.id === aiId ? { ...m, text: buffer } : m));
          }

          // Ultra-Low Latency Streaming Sentence & Micro-Clause TTS
          const shouldSpeak = fromVoice || voiceModeRef.current;
          if (shouldSpeak) {
            const unhandled = buffer.slice(spokenUpToIndex);
            // 1. Natural sentence terminator (. ! ? or newline)
            // 2. Natural clause break (, ; : —) if preceded by at least 10 chars
            // 3. Safety break: if unhandled text exceeds 40 chars, break at nearest word boundary
            const chunkMatch =
              unhandled.match(/^([\s\S]*?[.!?\n])(?:\s+|$)/) ||
              unhandled.match(/^([\s\S]{10,}?[,;:—])(?:\s+|$)/) ||
              unhandled.match(/^([\s\S]{36,52}\s)/);

            if (chunkMatch && chunkMatch[1].trim().length > 1) {
              const chunkToSpeak = chunkMatch[1].trim();
              spokenUpToIndex += chunkMatch[0].length;
              updateVoiceState("SPEAKING");
              ttsRef.current.enqueueSentence(chunkToSpeak);
            }
          }
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setLoading(false);
      setStreaming(false);
      setSearchStatus(null);
      if (!gotFirstToken) {
        setChat(prev => [...prev, {
          id: aiId,
          sender: "ai",
          text: "⚠ Could not reach Aegis backend. Make sure the uvicorn server is running on port 8000.",
          timestamp: Date.now(),
        }]);
      } else {
        setChat(prev => prev.map(m => m.id === aiId ? { ...m, streaming: false } : m));
      }
      if (voiceModeRef.current) updateVoiceState("LISTENING");
      else updateVoiceState("IDLE");
    };
  }, [message, loading, streaming, activeModel, updateVoiceState]);

  // Faster-Whisper Transcribe
  const transcribeAndSend = useCallback(async (blob: Blob, mimeType: string) => {
    stopLiveSpeechRecognition();

    if (blob.size === 0) {
      if (voiceModeRef.current) updateVoiceState("LISTENING");
      else updateVoiceState("IDLE");
      return;
    }

    updateVoiceState("TRANSCRIBING");

    try {
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
      const formData = new FormData();
      formData.append("file", blob, `recording.${ext}`);

      const res = await fetch(`${BASE}/voice/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("Transcription failed:", res.status, res.statusText);
        playAudioCue("error", audioCuesEnabledRef.current);
        updateVoiceState("ERROR", "Couldn't transcribe audio.");
        setTimeout(() => {
          if (voiceModeRef.current) updateVoiceState("LISTENING");
          else updateVoiceState("IDLE");
        }, 2200);
        return;
      }

      const data: { text?: string } = await res.json();
      const transcript = (data.text || "").trim();

      if (transcript) {
        setLiveTranscript(transcript);
        sendMessage(transcript, true);
      } else {
        if (voiceModeRef.current) updateVoiceState("LISTENING");
        else updateVoiceState("IDLE");
      }
    } catch (err) {
      console.error("Transcription network error:", err);
      playAudioCue("error", audioCuesEnabledRef.current);
      updateVoiceState("ERROR", "Network error during transcription.");
      setTimeout(() => {
        if (voiceModeRef.current) updateVoiceState("LISTENING");
        else updateVoiceState("IDLE");
      }, 2200);
    }
  }, [sendMessage, updateVoiceState]);

  // MediaRecorder handlers
  const startMediaRecorder = useCallback((stream: MediaStream) => {
    try {
      setLiveTranscript("");
      startLiveSpeechRecognition();

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: finalMimeType });
        audioChunksRef.current = [];
        if (blob.size > 0) {
          transcribeAndSend(blob, finalMimeType);
        } else {
          if (voiceModeRef.current) updateVoiceState("LISTENING");
          else updateVoiceState("IDLE");
        }
      };

      recorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        playAudioCue("error", audioCuesEnabledRef.current);
        updateVoiceState("ERROR", "Recording error.");
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err) {
      console.error("Failed to start MediaRecorder:", err);
      updateVoiceState("ERROR", "Failed to start recorder.");
    }
  }, [transcribeAndSend, updateVoiceState, startLiveSpeechRecognition]);

  const stopMediaRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    stopLiveSpeechRecognition();
  }, [stopLiveSpeechRecognition]);

  // VAD Listeners
  useEffect(() => {
    const vad = vadRef.current;

    vad.onEnergyLevel = (level) => {
      setAudioEnergy(level);
    };

    vad.onSpeechStart = () => {
      if (voiceStateRef.current === "LISTENING") {
        updateVoiceState("RECORDING");
        playAudioCue("speech_start", audioCuesEnabledRef.current);
        if (mediaStreamRef.current) {
          startMediaRecorder(mediaStreamRef.current);
        }
      }
    };

    vad.onSpeechEnd = () => {
      if (voiceStateRef.current === "RECORDING") {
        playAudioCue("speech_stop", audioCuesEnabledRef.current);
        stopMediaRecorder();
      }
    };

    vad.onBargeIn = () => {
      if (voiceStateRef.current === "SPEAKING" || voiceStateRef.current === "THINKING") {
        ttsRef.current.cancel();
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }
        setSearchStatus(null);
        setLoading(false);
        setStreaming(false);
        playAudioCue("interrupted", audioCuesEnabledRef.current);
        updateVoiceState("INTERRUPTED");

        if (mediaStreamRef.current) {
          setTimeout(() => {
            updateVoiceState("RECORDING");
            startMediaRecorder(mediaStreamRef.current!);
          }, 80);
        }
      }
    };
  }, [updateVoiceState, startMediaRecorder, stopMediaRecorder]);

  // Toggle Voice Conversation Mode
  const activateVoiceMode = useCallback(async () => {
    try {
      ttsRef.current.cancel();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      setVoiceMode(true);
      voiceModeRef.current = true;
      updateVoiceState("LISTENING");

      vadRef.current.start(stream, () => voiceStateRef.current);
      playAudioCue("activated", audioCuesEnabledRef.current);
    } catch (err) {
      console.error("Microphone denied:", err);
      playAudioCue("error", audioCuesEnabledRef.current);
      updateVoiceState("ERROR", "Microphone access denied.");
      setTimeout(() => updateVoiceState("IDLE"), 3000);
    }
  }, [updateVoiceState]);

  const deactivateVoiceMode = useCallback(() => {
    setVoiceMode(false);
    voiceModeRef.current = false;
    vadRef.current.stop();
    stopMediaRecorder();
    ttsRef.current.cancel();
    cleanupStream();
    setAudioEnergy(0);
    setLiveTranscript("");
    setSearchStatus(null);
    updateVoiceState("IDLE");
    playAudioCue("deactivated", audioCuesEnabledRef.current);
  }, [cleanupStream, stopMediaRecorder, updateVoiceState]);

  const toggleVoiceMode = useCallback(() => {
    if (voiceMode) deactivateVoiceMode();
    else activateVoiceMode();
  }, [voiceMode, activateVoiceMode, deactivateVoiceMode]);

  // Manual Push-to-Talk
  const startManualRecording = useCallback(async () => {
    if (voiceState !== "IDLE") return;
    try {
      ttsRef.current.cancel();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      updateVoiceState("RECORDING");
      playAudioCue("speech_start", audioCuesEnabledRef.current);

      vadRef.current.start(stream, () => voiceStateRef.current);
      startMediaRecorder(stream);
    } catch (err) {
      console.error("Mic error:", err);
      playAudioCue("error", audioCuesEnabledRef.current);
      updateVoiceState("ERROR", "Microphone denied.");
      setTimeout(() => updateVoiceState("IDLE"), 2500);
    }
  }, [voiceState, startMediaRecorder, updateVoiceState]);

  const stopManualRecording = useCallback(() => {
    if (voiceState === "RECORDING") {
      playAudioCue("speech_stop", audioCuesEnabledRef.current);
      vadRef.current.stop();
      stopMediaRecorder();
      cleanupStream();
    }
  }, [voiceState, cleanupStream, stopMediaRecorder]);

  const toggleManualRecording = useCallback(() => {
    if (voiceState === "RECORDING") stopManualRecording();
    else if (voiceState === "IDLE") startManualRecording();
  }, [voiceState, startManualRecording, stopManualRecording]);

  const handleBubbleSpeak = (text: string) => {
    if (ttsRef.current.isSpeaking()) {
      ttsRef.current.cancel();
      if (!voiceModeRef.current) updateVoiceState("IDLE");
    } else {
      updateVoiceState("SPEAKING");
      ttsRef.current.speak(text, () => {
        if (voiceModeRef.current) updateVoiceState("LISTENING");
        else updateVoiceState("IDLE");
      });
    }
  };

  // Keyboard Shortcuts (Tab=Toggle View Mode, Esc=Abort, Ctrl+M=Voice, Ctrl+L=Clear)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setViewMode(prev => (prev === "HUD" ? "TERMINAL" : "HUD"));
      }
      if (e.key === "Escape") {
        if (loading || streaming || voiceState === "SPEAKING") {
          abort();
        } else if (voiceState === "RECORDING") {
          stopManualRecording();
        } else if (voiceMode) {
          deactivateVoiceMode();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        setShowClearConfirm(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        toggleVoiceMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, streaming, voiceState, voiceMode, abort, stopManualRecording, deactivateVoiceMode, toggleVoiceMode]);

  // Clean on unmount
  useEffect(() => {
    return () => {
      vadRef.current.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      ttsRef.current.cancel();
      cleanupStream();
    };
  }, [cleanupStream]);

  // Regenerate
  const regenerate = useCallback(() => {
    const lastUser = [...chat].reverse().find(m => m.sender === "user");
    if (!lastUser) return;
    setChat(prev => {
      const idx = [...prev].reverse().findIndex(m => m.sender === "ai");
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.slice(0, realIdx);
    });
    setTimeout(() => sendMessage(lastUser.text), 50);
  }, [chat, sendMessage]);

  // Copy
  const copyMsg = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1800);
    });
  }, []);

  // Clear
  const confirmClear = async () => {
    abort();
    setChat([]);
    localStorage.removeItem("aegis_chat");
    setShowClearConfirm(false);
    try { await fetch(`${BASE}/history/${SESSION_ID}`, { method: "DELETE" }); } catch { /* offline */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const isEmpty = chat.length === 0;
  const isActive = loading || streaming;
  const isSpeaking = voiceState === "SPEAKING" || ttsRef.current.isSpeaking();

  const lastUserMsg = [...chat].reverse().find(m => m.sender === "user")?.text;
  const lastAiMsg = [...chat].reverse().find(m => m.sender === "ai")?.text;

  return (
    <>
      {/* ── Clear Confirm Dialog ─────────────────────── */}
      {showClearConfirm && (
        <div className="overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="dialog hud-corner-box" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--cyan-glow)", fontFamily: "'Orbitron', monospace", letterSpacing: "1px" }}>
              CLEAR SESSION DATA?
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", fontFamily: "'Outfit', sans-serif" }}>
              This will wipe active message memory and reset Aegis's local session context.
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="hud-btn" onClick={() => setShowClearConfirm(false)}>CANCEL</button>
              <button className="hud-btn hud-btn-danger" onClick={confirmClear}>PURGE MEMORY</button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-deep)",
          color: "var(--text-main)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* ── Top Futuristic HUD Bar ──────────────────────── */}
        <header
          style={{
            position: viewMode === "HUD" ? "absolute" : "relative",
            top: 0,
            left: 0,
            right: 0,
            height: "56px",
            borderBottom: viewMode === "HUD" ? "none" : "1px solid var(--cyan-border)",
            background: viewMode === "HUD" ? "linear-gradient(180deg, rgba(3, 7, 18, 0.75) 0%, rgba(3, 7, 18, 0) 100%)" : "var(--bg-header)",
            backdropFilter: viewMode === "HUD" ? "none" : "blur(14px)",
            WebkitBackdropFilter: viewMode === "HUD" ? "none" : "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            zIndex: 10,
            flexShrink: 0,
            pointerEvents: "auto",
          }}
        >
          {/* Logo & System Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, var(--cyan-dim), var(--cyan-glow))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Orbitron', monospace",
                fontWeight: 800,
                fontSize: "14px",
                color: "#fff",
                boxShadow: "0 0 14px var(--shadow-glow)",
              }}
            >
              Æ
            </div>
            <div>
              <div style={{ fontFamily: "'Orbitron', monospace", fontSize: "14px", fontWeight: 700, letterSpacing: "1.5px", color: "var(--text-main)" }}>
                AEGIS <span style={{ color: "var(--cyan-glow)", fontSize: "10px", letterSpacing: "1px" }}>// AI</span>
              </div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "10px", color: "var(--text-muted)", letterSpacing: "1px", textTransform: "uppercase" }}>
                ADAPTIVE ENGINE FOR GENERAL INTELLIGENCE & SYSTEMS
              </div>
            </div>
          </div>

          {/* Center Mode Switcher Tabs */}
          <div
            style={{
              display: "flex",
              background: "var(--cyan-hover)",
              border: "1px solid var(--cyan-border)",
              borderRadius: "6px",
              padding: "3px",
            }}
          >
            <button
              onClick={() => setViewMode("HUD")}
              className={`hud-btn ${viewMode === "HUD" ? "active" : ""}`}
              style={{
                padding: "5px 14px",
                borderRadius: "4px",
                fontSize: "11px",
                background: viewMode === "HUD" ? "var(--cyan-border-active)" : "transparent",
                border: "none",
              }}
            >
              ◈ HOLOGRAPHIC HUD
            </button>
            <button
              onClick={() => setViewMode("TERMINAL")}
              className={`hud-btn ${viewMode === "TERMINAL" ? "active" : ""}`}
              style={{
                padding: "5px 14px",
                borderRadius: "4px",
                fontSize: "11px",
                background: viewMode === "TERMINAL" ? "var(--cyan-border-active)" : "transparent",
                border: "none",
              }}
            >
              ≡ COMMAND TERMINAL
            </button>
          </div>

          {/* Right Header Action Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Theme Toggle (Light/Dark) */}
            <button
              onClick={toggleTheme}
              className="hud-btn"
              style={{ padding: "5px 10px", fontSize: "11px" }}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              <span>{theme === "dark" ? "☀️ LIGHT" : "🌙 DARK"}</span>
            </button>

            {/* Voice Mode Toggle */}
            <button
              onClick={toggleVoiceMode}
              className={`hud-btn ${voiceMode ? "active" : ""}`}
              style={{ padding: "5px 12px", fontSize: "11px" }}
              title="Toggle Hands-Free Voice Conversation Mode (Ctrl+M)"
            >
              <span>{voiceMode ? "● VOICE ACTIVE" : "🎙 VOICE MODE"}</span>
            </button>

            {/* Speech Rate Control */}
            <button
              onClick={cycleSpeechRate}
              className="hud-btn"
              style={{
                padding: "5px 11px",
                fontSize: "11px",
                fontFamily: "'Orbitron', monospace",
                letterSpacing: "0.5px",
                borderColor: speechRate >= 1.6 ? "var(--cyan-glow)" : "var(--cyan-border)",
                color: speechRate >= 1.6 ? "var(--cyan-glow)" : "var(--text-cyan)",
                boxShadow: speechRate >= 1.6 ? "0 0 10px rgba(0,240,255,0.25)" : "none",
                transition: "all 0.2s ease",
              }}
              title="Click to adjust Speech Speed: 1.2x (Normal) -> 1.5x (Fast) -> 1.75x (Very Fast) -> 2.0x (Warp Speed)"
            >
              <span>⚡ {speechRate.toFixed(2)}x {speechRate >= 1.9 ? "WARP" : speechRate >= 1.6 ? "VERY FAST" : speechRate >= 1.4 ? "FAST" : "NORM"}</span>
            </button>

            {/* Model Select */}
            {models.length > 0 && (
              <select
                className="model-select"
                value={activeModel}
                onChange={e => setActiveModel(e.target.value)}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--cyan-border)",
                  color: "var(--text-cyan)",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontFamily: "'DM Mono', monospace",
                  borderRadius: "4px",
                  outline: "none",
                }}
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}

            {/* Clear Button */}
            {chat.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="hud-btn"
                style={{ padding: "5px 10px", fontSize: "11px" }}
                title="Clear conversation memory (Ctrl+L)"
              >
                PURGE
              </button>
            )}
          </div>
        </header>

        {/* ── Main View Switcher ──────────────────────────── */}
        <main style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {viewMode === "HUD" ? (
            <AegisHudView
              voiceState={voiceState}
              audioEnergy={audioEnergy}
              isVoiceMode={voiceMode}
              activeModel={activeModel}
              backendStatus={status}
              messageCount={chat.length}
              audioCuesEnabled={audioCuesEnabled}
              theme={theme}
              liveTranscript={liveTranscript}
              searchStatus={searchStatus}
              actionStatus={actionStatus}
              lastUserMessage={lastUserMsg}
              lastAiMessage={lastAiMsg}
              isStreaming={streaming}
              isLoading={loading}
              onToggleVoiceMode={toggleVoiceMode}
              onToggleAudioCues={() => setAudioCuesEnabled(prev => !prev)}
              onAbort={abort}
              onSwitchToTerminal={() => setViewMode("TERMINAL")}
            />
          ) : (
            <AegisChatConsole
              chat={chat}
              loading={loading}
              streaming={streaming}
              searchStatus={searchStatus}
              actionStatus={actionStatus}
              activeModel={activeModel}
              voiceState={voiceState}
              audioEnergy={audioEnergy}
              isVoiceMode={voiceMode}
              theme={theme}
              speechRate={speechRate}
              isSpeaking={isSpeaking}
              onSendMessage={sendMessage}
              onAbort={abort}
              onToggleVoiceMode={toggleVoiceMode}
              onSwitchToHud={() => setViewMode("HUD")}
              onSpeakText={handleBubbleSpeak}
              onRegenerate={regenerate}
              onClearHistory={() => setShowClearConfirm(true)}
            />
          )}
        </main>
      </div>
    </>
  );
}