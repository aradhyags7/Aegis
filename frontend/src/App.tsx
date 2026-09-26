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
} from "./voiceController";

import { AegisHudView } from "./components/AegisHudView";

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
// Markdown renderer (zero-dependency, inline React)
// ─────────────────────────────────────────────────────────

interface CopyBtnProps { code: string }
function CopyBtn({ code }: CopyBtnProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={copy}
      style={{
        position: "absolute",
        top: "8px",
        right: "8px",
        background: copied ? "var(--cyan-border-active)" : "var(--bg-card)",
        border: "1px solid var(--cyan-border)",
        color: copied ? "var(--cyan-glow)" : "var(--text-muted)",
        fontSize: "11px",
        padding: "3px 10px",
        borderRadius: "4px",
        cursor: "pointer",
        fontFamily: "'DM Mono', monospace",
        transition: "all 0.15s",
      }}
    >
      {copied ? "✓ COPIED" : "COPY"}
    </button>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} style={{ color: "var(--text-main)", fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code
          key={i}
          style={{
            background: "var(--cyan-hover)",
            color: "var(--text-cyan)",
            border: "1px solid var(--cyan-border)",
            padding: "1px 6px",
            borderRadius: "4px",
            fontSize: "13px",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith("*") && p.endsWith("*")) {
      return <em key={i} style={{ color: "var(--text-muted)" }}>{p.slice(1, -1)}</em>;
    }
    return p;
  });
}

function MarkdownRenderer({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      const code = codeLines.join("\n");
      nodes.push(
        <div key={`code-${i}`} style={{ position: "relative", margin: "12px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg-header)",
              borderRadius: "6px 6px 0 0",
              padding: "6px 12px",
              border: "1px solid var(--cyan-border)",
              borderBottom: "none",
            }}
          >
            <span style={{ fontSize: "11px", color: "var(--text-cyan)", fontFamily: "'Orbitron', monospace", letterSpacing: "1px" }}>
              // {lang.toUpperCase()}
            </span>
          </div>
          <pre
            style={{
              background: "var(--bg-deep)",
              margin: 0,
              padding: "14px 16px",
              borderRadius: "0 0 6px 6px",
              overflowX: "auto",
              fontSize: "13px",
              lineHeight: "1.6",
              color: "var(--text-main)",
              fontFamily: "'DM Mono', monospace",
              border: "1px solid var(--cyan-border)",
            }}
          >
            <code>{code}</code>
          </pre>
          <CopyBtn code={code} />
        </div>
      );
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h3) {
      nodes.push(<h3 key={i} style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-cyan)", margin: "10px 0 4px", fontFamily: "'Orbitron', monospace" }}>{renderInline(h3[1])}</h3>);
      i++; continue;
    }
    if (h2) {
      nodes.push(<h2 key={i} style={{ fontSize: "15px", fontWeight: 600, color: "var(--blue-core)", margin: "12px 0 4px", fontFamily: "'Orbitron', monospace" }}>{renderInline(h2[1])}</h2>);
      i++; continue;
    }
    if (h1) {
      nodes.push(<h1 key={i} style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-main)", margin: "12px 0 6px", fontFamily: "'Orbitron', monospace" }}>{renderInline(h1[1])}</h1>);
      i++; continue;
    }

    // Bullet list
    if (line.match(/^[-*] .+/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*] .+/)) {
        items.push(
          <li key={i} style={{ padding: "2px 0", color: "var(--text-secondary)" }}>
            {renderInline(lines[i].replace(/^[-*] /, ""))}
          </li>
        );
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} style={{ margin: "6px 0", paddingLeft: "18px", listStyle: "square" }}>{items}</ul>);
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. .+/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. .+/)) {
        items.push(
          <li key={i} style={{ padding: "2px 0", color: "var(--text-secondary)" }}>
            {renderInline(lines[i].replace(/^\d+\. /, ""))}
          </li>
        );
        i++;
      }
      nodes.push(<ol key={`ol-${i}`} style={{ margin: "6px 0", paddingLeft: "18px" }}>{items}</ol>);
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      nodes.push(<hr key={i} style={{ border: "none", borderTop: "1px solid var(--cyan-border)", margin: "10px 0" }} />);
      i++; continue;
    }

    // Empty line
    if (line.trim() === "") {
      nodes.push(<div key={i} style={{ height: "6px" }} />);
      i++; continue;
    }

    // Paragraph
    nodes.push(
      <p key={i} style={{ margin: "3px 0", color: "var(--text-secondary)", lineHeight: "1.65" }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return (
    <div style={{ fontSize: "14.5px", fontFamily: "'Outfit', sans-serif" }}>
      {nodes}
      {streaming && (
        <span
          style={{
            display: "inline-block",
            width: "2px",
            height: "14px",
            background: "var(--cyan-glow)",
            marginLeft: "2px",
            verticalAlign: "middle",
            animation: "blink 0.8s step-end infinite",
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MessageBubble Component
// ─────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onCopy,
  onRegenerate,
  onSpeak,
  isSpeaking,
  isLast,
}: {
  msg: Message;
  onCopy: (text: string) => void;
  onRegenerate?: () => void;
  onSpeak?: () => void;
  isSpeaking?: boolean;
  isLast: boolean;
}) {
  const isUser = msg.sender === "user";
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        animation: "fadeSlideIn 0.2s ease forwards",
        gap: "4px",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", maxWidth: "84%" }}>
        {!isUser && (
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, var(--cyan-dim), var(--cyan-glow))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "800",
              color: "#fff",
              flexShrink: 0,
              marginTop: "2px",
              fontFamily: "'Orbitron', monospace",
              boxShadow: "0 0 12px var(--shadow-glow)",
            }}
          >
            Æ
          </div>
        )}

        <div
          className={isUser ? "" : "hud-corner-box"}
          style={{
            padding: isUser ? "10px 16px" : "14px 18px",
            borderRadius: isUser ? "16px 16px 2px 16px" : "4px",
            background: isUser
              ? "linear-gradient(135deg, var(--blue-deep), var(--blue-core))"
              : "var(--bg-card)",
            border: isUser ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid var(--cyan-border)",
            color: isUser ? "#f8fafc" : "var(--text-secondary)",
            boxShadow: isUser
              ? "0 2px 16px rgba(37, 99, 235, 0.3)"
              : "0 0 16px var(--shadow-glow)",
            wordBreak: "break-word",
            maxWidth: "100%",
          }}
        >
          {isUser ? (
            <p style={{ margin: 0, lineHeight: "1.6", fontSize: "14px", whiteSpace: "pre-wrap", fontFamily: "'Outfit', sans-serif" }}>
              {msg.text}
            </p>
          ) : (
            <MarkdownRenderer text={msg.text} streaming={msg.streaming} />
          )}
        </div>
      </div>

      {/* Actions row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          paddingLeft: isUser ? 0 : "40px",
          opacity: hover ? 1 : 0,
          transition: "opacity 0.15s",
          pointerEvents: hover ? "auto" : "none",
        }}
      >
        <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
          {fmtTime(msg.timestamp)}
        </span>
        <button
          onClick={() => onCopy(msg.text)}
          style={{
            background: "none",
            border: "1px solid var(--cyan-border)",
            color: "var(--text-muted)",
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "3px",
            cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          COPY
        </button>
        {!isUser && onSpeak && !msg.streaming && (
          <button
            onClick={onSpeak}
            style={{
              background: "none",
              border: "1px solid var(--cyan-border)",
              color: "var(--text-cyan)",
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "3px",
              cursor: "pointer",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {isSpeaking ? "■ STOP" : "🔊 SPEAK"}
          </button>
        )}
        {!isUser && isLast && onRegenerate && !msg.streaming && (
          <button
            onClick={onRegenerate}
            style={{
              background: "none",
              border: "1px solid var(--cyan-border)",
              color: "var(--text-muted)",
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "3px",
              cursor: "pointer",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            ↺ REGEN
          </button>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: "5px", padding: "4px 2px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "var(--cyan-glow)",
            display: "inline-block",
            boxShadow: "0 0 6px var(--cyan-glow)",
            animation: "bounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
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

  // Live Speech Recognition Helper (for real-time typing display while speaking)
  const startLiveSpeechRecognition = useCallback(() => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        let interimStr = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interimStr += event.results[i][0].transcript;
        }
        if (interimStr.trim()) {
          setLiveTranscript(interimStr.trim());
        }
      };

      rec.onerror = () => { /* fallback to Faster-Whisper audio blob */ };
      rec.onend = () => { /* end of interim session */ };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      /* ignore if unavailable in environment */
    }
  }, []);

  const stopLiveSpeechRecognition = useCallback(() => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } catch { /* ignore */ }
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

          // Near-Instant Streaming Sentence TTS
          const shouldSpeak = fromVoice || voiceModeRef.current;
          if (shouldSpeak) {
            const unhandled = buffer.slice(spokenUpToIndex);
            const sentenceMatch = unhandled.match(/^(.*?[.!?\n])(?:\s+|$)/);
            if (sentenceMatch && sentenceMatch[1].trim().length > 1) {
              const sentenceToSpeak = sentenceMatch[1].trim();
              spokenUpToIndex += sentenceMatch[0].length;
              updateVoiceState("SPEAKING");
              ttsRef.current.enqueueSentence(sentenceToSpeak);
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
      const transcript = data.text?.trim() || liveTranscript.trim();

      if (transcript) {
        setLiveTranscript(transcript);
        sendMessage(transcript, true);
      } else {
        if (voiceModeRef.current) updateVoiceState("LISTENING");
        else updateVoiceState("IDLE");
      }
    } catch (err) {
      console.error("Transcription network error:", err);
      // Fallback to interim transcript if available
      if (liveTranscript.trim()) {
        sendMessage(liveTranscript.trim(), true);
      } else {
        playAudioCue("error", audioCuesEnabledRef.current);
        updateVoiceState("ERROR", "Network error during transcription.");
        setTimeout(() => {
          if (voiceModeRef.current) updateVoiceState("LISTENING");
          else updateVoiceState("IDLE");
        }, 2200);
      }
    }
  }, [sendMessage, updateVoiceState, liveTranscript, stopLiveSpeechRecognition]);

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
            height: "56px",
            borderBottom: "1px solid var(--cyan-border)",
            background: "var(--bg-header)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            zIndex: 10,
            flexShrink: 0,
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
            /* ── Tactical Command Terminal Mode ────────────── */
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <div className="hud-grid-background" />

              {/* Chat Message Stream */}
              <div
                ref={scrollRef}
                onScroll={onScroll}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px 32px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  zIndex: 2,
                }}
              >
                {isEmpty && (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "16px",
                      marginTop: "80px",
                    }}
                  >
                    <div
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "16px",
                        background: "linear-gradient(135deg, var(--cyan-dim), var(--cyan-glow))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "26px",
                        fontWeight: 800,
                        color: "#fff",
                        fontFamily: "'Orbitron', monospace",
                        boxShadow: "0 0 32px var(--shadow-glow)",
                      }}
                    >
                      Æ
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "'Orbitron', monospace", fontSize: "18px", fontWeight: 700, color: "var(--text-main)", letterSpacing: "1px" }}>
                        AEGIS COMMAND TERMINAL
                      </div>
                      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                        Adaptive Engine for General Intelligence & Systems · {activeModel}
                      </div>
                    </div>
                  </div>
                )}

                {chat.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onCopy={copyMsg}
                    onRegenerate={regenerate}
                    onSpeak={msg.sender === "ai" ? () => handleBubbleSpeak(msg.text) : undefined}
                    isSpeaking={isSpeaking}
                    isLast={idx === chat.length - 1}
                  />
                ))}

                {loading && !streaming && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "8px",
                        background: "linear-gradient(135deg, var(--cyan-dim), var(--cyan-glow))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "800",
                        color: "#fff",
                        fontFamily: "'Orbitron', monospace",
                      }}
                    >
                      Æ
                    </div>
                    <div className="hud-corner-box" style={{ padding: "10px 16px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "10px" }}>
                      <TypingDots />
                      {actionStatus && (
                        <span style={{ fontSize: "12.5px", color: "var(--amber-warn)", fontFamily: "'DM Mono', monospace" }}>
                          ⚡ {actionStatus}
                        </span>
                      )}
                      {searchStatus && (
                        <span style={{ fontSize: "12.5px", color: "var(--text-cyan)", fontFamily: "'DM Mono', monospace" }}>
                          🌐 {searchStatus}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Input Action Bar */}
              <div
                style={{
                  padding: "14px 28px 20px",
                  borderTop: "1px solid var(--cyan-border)",
                  background: "var(--bg-header)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  zIndex: 3,
                }}
              >
                <div
                  className="hud-corner-box"
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "10px",
                    padding: "10px 14px",
                    border: `1px solid ${voiceState === "RECORDING" ? "var(--red-hazard)" : voiceMode ? "var(--cyan-glow)" : "var(--cyan-border)"}`,
                    boxShadow: voiceMode ? "0 0 16px var(--shadow-glow)" : "none",
                  }}
                >
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={e => { setMessage(e.target.value); resizeTextarea(e.target); }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      voiceState === "RECORDING"
                        ? `Live Speech: ${liveTranscript || "Listening…"}`
                        : voiceMode
                        ? "Voice Mode active · speak freely or enter message…"
                        : "Enter message…  (⏎ send · ⇧⏎ newline · ⎋ abort · Tab HUD)"
                    }
                    rows={1}
                    style={{
                      flex: 1,
                      background: "transparent",
                      color: "var(--text-main)",
                      border: "none",
                      fontSize: "14px",
                      lineHeight: "1.55",
                      maxHeight: "160px",
                      overflowY: "auto",
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  />

                  {isActive || isSpeaking ? (
                    <button onClick={abort} className="hud-btn hud-btn-danger" style={{ padding: "6px 12px" }}>
                      ■ STOP
                    </button>
                  ) : (
                    <>
                      <button
                        className={`hud-btn ${voiceState === "RECORDING" ? "hud-btn-danger" : ""}`}
                        onClick={voiceMode ? toggleVoiceMode : toggleManualRecording}
                        style={{ padding: "6px 12px" }}
                        title={voiceMode ? "Voice Mode Active" : "Push to talk"}
                      >
                        {voiceState === "RECORDING" ? "● RECORDING" : "🎤 VOICE"}
                      </button>
                      <button
                        onClick={() => sendMessage()}
                        disabled={!message.trim()}
                        className="hud-btn"
                        style={{ padding: "6px 12px" }}
                      >
                        SEND ↵
                      </button>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
                  <span>AEGIS PROTOCOL // REAL-TIME TIME-AWARE SEARCH ARMED</span>
                  <span>{message.length > 0 ? `${message.length} CHARS` : "READY"}</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}