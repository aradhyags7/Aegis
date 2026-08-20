/**
 * Aegis AI — Maximum Frontend
 *
 * Features:
 *  ✦ SSE streaming with live token-by-token rendering + blinking cursor
 *  ✦ Full inline Markdown renderer  (code blocks, inline code, bold, italic, lists, headings)
 *  ✦ Syntax-highlighted code blocks with one-click copy
 *  ✦ Abort / cancel mid-stream
 *  ✦ Session ID (UUID, persisted to localStorage)
 *  ✦ Chat history persisted to localStorage
 *  ✦ Smart auto-scroll (pauses when user scrolls up)
 *  ✦ Real-time backend health polling
 *  ✦ Dynamic model list fetched from /models
 *  ✦ Copy any message to clipboard
 *  ✦ Regenerate last response
 *  ✦ Clear chat (local + backend memory)
 *  ✦ Message timestamps
 *  ✦ Keyboard shortcuts: Enter=send  Esc=abort  Ctrl+L=clear
 *  ✦ Typing indicator only while waiting for first token
 *  ✦ Voice input via MediaRecorder → /voice/transcribe (Faster-Whisper backend)
 *  ✦ Visual feedback for recording state
 *  ✦ Text-to-Speech (speechSynthesis)
 *  ✦ Zero extra dependencies — pure React + TypeScript
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function getSessionId(): string {
  let id = localStorage.getItem("aegis_session");
  if (!id) { id = uuid(); localStorage.setItem("aegis_session", id); }
  return id;
}

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem("aegis_chat");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(msgs: Message[]) {
  // keep last 100 messages only
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
    <button onClick={copy} style={{
      position: "absolute", top: "10px", right: "10px",
      background: copied ? "#1a3a5c" : "#0d1f35",
      border: "1px solid #1e3a5f",
      color: copied ? "#60a5fa" : "#475569",
      fontSize: "11px", padding: "3px 10px", borderRadius: "6px",
      cursor: "pointer", fontFamily: "'DM Mono', monospace",
      transition: "all 0.15s",
    }}>
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function renderInline(text: string): React.ReactNode[] {
  // bold, italic, inline code
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} style={{ color: "#e2e8f0", fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={i} style={{
          background: "#0d1f35", color: "#7dd3fc",
          padding: "1px 6px", borderRadius: "4px",
          fontSize: "13px", fontFamily: "'DM Mono', monospace",
        }}>{p.slice(1, -1)}</code>
      );
    if (p.startsWith("*") && p.endsWith("*"))
      return <em key={i} style={{ color: "#94a3b8" }}>{p.slice(1, -1)}</em>;
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
        <div key={`code-${i}`} style={{ position: "relative", margin: "10px 0" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#06101e", borderRadius: "8px 8px 0 0",
            padding: "6px 12px", borderBottom: "1px solid #1e3a5f",
          }}>
            <span style={{ fontSize: "11px", color: "#334155", fontFamily: "'DM Mono', monospace" }}>
              {lang}
            </span>
          </div>
          <pre style={{
            background: "#060f1c", margin: 0, padding: "14px 16px",
            borderRadius: "0 0 8px 8px", overflowX: "auto",
            fontSize: "13px", lineHeight: "1.6",
            color: "#93c5fd", fontFamily: "'DM Mono', monospace",
            border: "1px solid #1e293b", borderTop: "none",
          }}>
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
    if (h3) { nodes.push(<h3 key={i} style={{ fontSize: "14px", fontWeight: 600, color: "#93c5fd", margin: "10px 0 4px" }}>{renderInline(h3[1])}</h3>);
i++; continue; }
    if (h2) { nodes.push(<h2 key={i} style={{ fontSize: "15px", fontWeight: 600, color: "#bfdbfe", margin: "12px 0 4px" }}>{renderInline(h2[1])}</h2>);
i++; continue; }
    if (h1) { nodes.push(<h1 key={i} style={{ fontSize: "17px", fontWeight: 700, color: "#e2e8f0", margin: "12px 0 6px" }}>{renderInline(h1[1])}</h1>);
i++; continue; }

    // Bullet list
    if (line.match(/^[-*] .+/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*] .+/)) {
        items.push(
          <li key={i} style={{ padding: "2px 0", color: "#cbd5e1" }}>
            {renderInline(lines[i].replace(/^[-*] /, ""))}
          </li>
        );
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} style={{ margin: "6px 0", paddingLeft: "18px", listStyle: "disc" }}>{items}</ul>);
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. .+/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. .+/)) {
        items.push(
          <li key={i} style={{ padding: "2px 0", color: "#cbd5e1" }}>
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
      nodes.push(<hr key={i} style={{ border: "none", borderTop: "1px solid #1e293b", margin: "10px 0" }} />);
      i++; continue;
    }

    // Empty line = spacer
    if (line.trim() === "") {
      nodes.push(<div key={i} style={{ height: "6px" }} />);
      i++; continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={i} style={{ margin: "2px 0", color: "#cbd5e1", lineHeight: "1.65" }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return (
    <div style={{ fontSize: "14.5px", fontFamily: "'DM Sans', sans-serif" }}>
      {nodes}
      {streaming && (
        <span style={{
          display: "inline-block", width: "2px", height: "14px",
          background: "#3b82f6", marginLeft: "2px", verticalAlign: "middle",
          animation: "blink 0.9s step-end infinite",
        }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MessageBubble
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
        animation: "fadeSlideIn 0.22s ease forwards",
        gap: "4px",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", maxWidth: "80%" }}>
        {!isUser && (
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: "linear-gradient(135deg, #1e40af, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "11px", fontWeight: "700", color: "white",
            flexShrink: 0, marginTop: "2px",
            fontFamily: "'DM Mono', monospace",
          }}>Æ</div>
        )}

        <div style={{
          padding: isUser ? "11px 15px" : "13px 16px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser ? "linear-gradient(135deg, #1d4ed8, #2563eb)" : "#0a1628",
          border: isUser ? "none" : "1px solid #1a2e4a",
          color: isUser ? "#e0eaff" : "#cbd5e1",
          boxShadow: isUser ? "0 2px 14px rgba(37,99,235,0.25)" : "0 1px 6px rgba(0,0,0,0.4)",
          wordBreak: "break-word",
          maxWidth: "100%",
        }}>
          {isUser
            ? <p style={{ margin: 0, lineHeight: "1.6", fontSize: "14.5px", whiteSpace: "pre-wrap" }}>{msg.text}</p>
            : <MarkdownRenderer text={msg.text} streaming={msg.streaming} />
          }
        </div>
      </div>

      {/* Actions row */}
      <div style={{
        display: "flex", alignItems: "center", gap: "6px",
        paddingLeft: isUser ? 0 : "38px",
        opacity: hover ? 1 : 0,
        transition: "opacity 0.15s",
        pointerEvents: hover ? "auto" : "none",
      }}>
        <span style={{ fontSize: "10.5px", color: "#1e3a5f", fontFamily: "'DM Mono', monospace" }}>
          {fmtTime(msg.timestamp)}
        </span>
        <button onClick={() => onCopy(msg.text)} style={{
          background: "none", border: "1px solid #1e293b", color: "#334155",
          fontSize: "10.5px", padding: "2px 8px", borderRadius: "5px",
          cursor: "pointer", fontFamily: "'DM Mono', monospace",
          transition: "color 0.1s, border-color 0.1s",
        }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#60a5fa"; (e.target as HTMLElement).style.borderColor = "#1e3a5f"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#334155"; (e.target as HTMLElement).style.borderColor = "#1e293b"; }}
        >copy</button>
        {!isUser && onSpeak && !msg.streaming && (
          <button onClick={onSpeak} style={{
            background: "none", border: "1px solid #1e293b", color: "#334155",
            fontSize: "10.5px", padding: "2px 8px", borderRadius: "5px",
            cursor: "pointer", fontFamily: "'DM Mono', monospace",
            transition: "color 0.1s",
          }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#60a5fa"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#334155"; }}
          >{isSpeaking ? "■ stop" : "🔊 speak"}</button>
        )}
        {!isUser && isLast && onRegenerate && !msg.streaming && (
          <button onClick={onRegenerate} style={{
            background: "none", border: "1px solid #1e293b", color: "#334155",
            fontSize: "10.5px", padding: "2px 8px", borderRadius: "5px",
            cursor: "pointer", fontFamily: "'DM Mono', monospace",
            transition: "color 0.1s",
          }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#60a5fa"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#334155"; }}
          >↺ regenerate</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// TypingDots
// ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: "5px", padding: "3px 2px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: "6px", height: "6px", borderRadius: "50%", background: "#334155",
          display: "inline-block",
          animation: "bounce 1.2s ease-in-out infinite",
          animationDelay: `${i * 0.18}s`,
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Suggestions
// ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Explain quantum entanglement",
  "Write a Python async web scraper",
  "What is the Fermi paradox?",
  "Explain REST vs GraphQL",
  "Debug this: TypeError: Cannot read properties of undefined",
  "Summarize the French Revolution",
];

// ─────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────

const SESSION_ID = getSessionId();
const BASE = "http://127.0.0.1:8000";

export default function App() {
  const [message, setMessage]       = useState("");
  const [chat, setChat]             = useState<Message[]>(loadHistory);
  const [loading, setLoading]       = useState(false);        // waiting for first token
  const [speaking, setSpeaking]     = useState(false);
  const [streaming, setStreaming]   = useState(false);        // tokens flowing
  const [status, setStatus]         = useState<BackendStatus>("checking");
  const [models, setModels]         = useState<string[]>([]);
  const [activeModel, setActiveModel] = useState("llama3");
  const [copied, setCopied]         = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const chatEndRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const esRef       = useRef<EventSource | null>(null);
  const atBottomRef = useRef(true);
  const scrollRef   = useRef<HTMLDivElement>(null);

  // ── Voice recording state (MediaRecorder-based) ───────
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // ── Persist chat ──────────────────────────────────────
  useEffect(() => { saveHistory(chat.filter(m => !m.streaming)); }, [chat]);

  // ── Health polling ────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
        if (r.ok) {
          const d = await r.json();
          setStatus(d.ollama ? "online" : "offline");
        } else { setStatus("offline"); }
      } catch { setStatus("offline"); }
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);

  // ── Fetch models ──────────────────────────────────────
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

  // ── Smart auto-scroll ─────────────────────────────────
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  useLayoutEffect(() => {
    if (atBottomRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat, loading]);

  // ── Abort ─────────────────────────────────────────────
  const abort = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setLoading(false);
    setStreaming(false);
    // Mark the current streaming message as complete
    setChat(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
  }, []);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  // ── Send ──────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string, fromVoice = false) => {
    const userMessage = (text ?? message).trim();
    if (!userMessage || loading || streaming) return;

    const userMsg: Message = {
      id: uuid(), sender: "user", text: userMessage, timestamp: Date.now(),
    };
    const aiId = uuid();

    setChat(prev => [...prev, userMsg]);
    setMessage("");
    setLoading(true);
    atBottomRef.current = true;

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";

    const url = `${BASE}/ask/stream?prompt=${encodeURIComponent(userMessage)}&session_id=${SESSION_ID}&model=${encodeURIComponent(activeModel)}`;
    const es = new EventSource(url);
    esRef.current = es;

    let buffer = "";
    let gotFirstToken = false;

    es.onmessage = (event) => {
      if (event.data === "[DONE]") {
        es.close(); esRef.current = null;
        setStreaming(false);
        setLoading(false);
        setChat(prev => prev.map(m => m.id === aiId ? { ...m, streaming: false } : m));
        if (fromVoice && buffer.trim()) {
          speak(buffer.trim());
        }
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.error) {
          es.close();
          setStreaming(false); setLoading(false);
          setChat(prev => prev.map(m => m.id === aiId ? {
            ...m, text: `⚠ ${parsed.error}`, streaming: false
          } : m));
          return;
        }
        buffer += parsed.token ?? "";

        if (!gotFirstToken) {
          gotFirstToken = true;
          setLoading(false);
          setStreaming(true);
          // Insert the AI message bubble on first token
          setChat(prev => [...prev, { id: aiId, sender: "ai", text: buffer, timestamp: Date.now(), streaming: true }]);
        } else {
          setChat(prev => prev.map(m => m.id === aiId ? { ...m, text: buffer } : m));
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close(); esRef.current = null;
      setLoading(false); setStreaming(false);
      if (!gotFirstToken) {
        setChat(prev => [...prev, {
          id: aiId, sender: "ai",
          text: "⚠ Could not reach Aegis backend. Make sure the backend server is running.",
          timestamp: Date.now(),
        }]);
      } else {
        setChat(prev => prev.map(m => m.id === aiId ? { ...m, streaming: false } : m));
      }
    };
  }, [message, loading, streaming, activeModel]);

  // ── Keyboard shortcuts ────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (loading || streaming)) abort();
      if (e.key === "Escape" && isRecording) stopRecording();
      if ((e.ctrlKey || e.metaKey) && e.key === "l") { e.preventDefault(); promptClear(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, streaming, isRecording]);

  // ── Voice input: MediaRecorder → /voice/transcribe ────
  const playBeep = (kind: "start" | "stop") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = kind === "start" ? 880 : 440;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      osc.onended = () => ctx.close();
    } catch { /* ignore audio errors, non-critical */ }
  };

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

  const cleanupStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const showVoiceError = useCallback((text: string) => {
    setChat(prev => [...prev, {
      id: uuid(), sender: "ai", text, timestamp: Date.now(),
    }]);
  }, []);

  const transcribeAndSend = useCallback(async (blob: Blob, mimeType: string) => {
    if (blob.size === 0) {
      console.warn("Empty recording");
      return;
    }

    setIsTranscribing(true);
    try {
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
      const formData = new FormData();
      formData.append("file", blob, `recording.${ext}`);

      const res = await fetch(`${BASE}/voice/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("Voice transcription failed:", res.status, res.statusText);
        showVoiceError("⚠ Couldn't transcribe audio.");
        return;
      }

      const data: { text?: string } = await res.json();
      const transcript = data.text?.trim();

      if (transcript) {
        sendMessage(transcript, true);
      } else {
        console.error("Voice transcription returned empty text.");
        showVoiceError("⚠ Couldn't transcribe audio.");
      }
    } catch (err) {
      console.error("Voice transcription error:", err);
      showVoiceError("⚠ Couldn't transcribe audio.");
    } finally {
      setIsTranscribing(false);
    }
  }, [sendMessage, showVoiceError]);

  const startRecording = useCallback(async () => {
    if (isRecording || isTranscribing || loading || streaming) return;

    stopSpeaking();
    playBeep("start");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: finalMimeType });
        audioChunksRef.current = [];
        cleanupStream();
        if (blob.size > 0) {
          transcribeAndSend(blob, finalMimeType);
        }
      };

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setIsRecording(false);
        cleanupStream();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone permission denied or unavailable:", err);
      cleanupStream();
      setIsRecording(false);
    }
  }, [isRecording, isTranscribing, loading, streaming, cleanupStream, transcribeAndSend]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      cleanupStream();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    playBeep("stop");
  }, [cleanupStream]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      cleanupStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Regenerate ────────────────────────────────────────
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

  // ── Copy ──────────────────────────────────────────────
  const copyMsg = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1800);
    });
  }, []);

  // ── Clear ─────────────────────────────────────────────
  const promptClear = () => setShowClearConfirm(true);
  const confirmClear = async () => {
    abort();
    setChat([]);
    localStorage.removeItem("aegis_chat");
    setShowClearConfirm(false);
    try { await fetch(`${BASE}/history/${SESSION_ID}`, { method: "DELETE" }); } catch { /* offline */ }
  };

  // ── Input handlers ────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const resizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const isEmpty = chat.length === 0;
  const isActive = loading || streaming;

  const statusColor = status === "online" ? "#22c55e" : status === "offline" ? "#ef4444" : "#f59e0b";
  const statusLabel = status === "online" ? "online" : status === "offline" ? "offline" : "checking";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a2e4a; border-radius: 3px; }
        textarea { resize: none; font-family: inherit; }
        textarea:focus { outline: none; }
        button { font-family: inherit; }

        @keyframes bounce {
          0%,80%,100% { transform: scale(0.9); opacity: 0.35; }
          40%          { transform: scale(1.3);  opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 8px;
          font-size: 13px; color: #334155; cursor: pointer;
          transition: background 0.12s, color 0.12s;
          user-select: none;
        }
        .nav-item:hover  { background: #07192e; color: #64748b; }
        .nav-item.active { background: #0a2040; color: #60a5fa; }

        .chip {
          background: #060f1c; border: 1px solid #1a2e4a; color: #4a7ab5;
          font-size: 12px; padding: 7px 13px; border-radius: 18px;
          cursor: pointer; transition: all 0.14s; white-space: nowrap;
          font-family: 'DM Sans', sans-serif;
        }
        .chip:hover { background: #0a1f38; border-color: #2563eb; color: #93c5fd; }

        .send-btn {
          background: #1d4ed8; border: none; color: white;
          width: 36px; height: 36px; border-radius: 9px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.13s, transform 0.1s;
        }
        .send-btn:hover   { background: #1e40af; }
        .send-btn:active  { transform: scale(0.92); }
        .send-btn:disabled { background: #0a1628; cursor: not-allowed; opacity: 0.5; }

        .abort-btn {
          background: #1a0a0a; border: 1px solid #4b1111; color: #ef4444;
          width: 36px; height: 36px; border-radius: 9px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.13s;
          font-size: 13px;
        }
        .abort-btn:hover { background: #250d0d; }

        .mic-btn {
          background: #1d4ed8; border: none; color: white;
          width: 36px; height: 36px; border-radius: 9px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.13s, transform 0.1s;
        }
        .mic-btn:hover { background: #1e40af; }
        .mic-btn:active { transform: scale(0.92); }
        .mic-btn:disabled { background: #0a1628; cursor: not-allowed; opacity: 0.5; }

        .active-mic-btn {
          background: #ef4444; /* red while recording */
          animation: pulse 1.2s ease-in-out infinite;
        }
        .active-mic-btn:hover { background: #f87171; }

        .icon-btn {
          background: none; border: 1px solid transparent; color: #1e3a5f;
          padding: 5px 10px; border-radius: 6px; cursor: pointer;
          font-size: 11.5px; font-family: 'DM Mono', monospace;
          transition: color 0.12s, border-color 0.12s, background 0.12s;
        }
        .icon-btn:hover { color: #60a5fa; border-color: #1e3a5f; background: #060f1c; }

        .model-select {
          background: #060f1c; border: 1px solid #1a2e4a; color: #4a7ab5;
          font-size: 11px; padding: 4px 8px; border-radius: 6px;
          cursor: pointer; font-family: 'DM Mono', monospace;
          appearance: none; outline: none;
        }
        .model-select:hover { border-color: #2563eb; }

        .overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          z-index: 100; animation: fadeSlideIn 0.15s ease;
        }
        .dialog {
          background: #060f1c; border: 1px solid #1a2e4a;
          border-radius: 14px; padding: 24px 28px;
          display: flex; flex-direction: column; gap: 16px;
          min-width: 300px;
        }
      `}</style>

      {/* ── Clear Confirm Dialog ─────────────────────── */}
      {showClearConfirm && (
        <div className="overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}>
              Clear conversation?
            </div>
            <div style={{ fontSize: "13px", color: "#475569", fontFamily: "'DM Sans', sans-serif" }}>
              This will delete all messages and reset Aegis's memory for this session.
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="icon-btn" onClick={() => setShowClearConfirm(false)}>cancel</button>
              <button onClick={confirmClear} style={{
                background: "#1a0a0a", border: "1px solid #4b1111", color: "#ef4444",
                padding: "6px 16px", borderRadius: "8px", cursor: "pointer",
                fontSize: "12px", fontFamily: "'DM Mono', monospace",
              }}>clear</button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        height: "100vh", background: "#020c1b", color: "white",
        display: "flex", fontFamily: "'DM Sans', sans-serif", overflow: "hidden",
      }}>

        {/* ── Sidebar ──────────────────────────────── */}
        <div style={{
          width: "220px", background: "#030d1a",
          borderRight: "1px solid #0a1e30",
          display: "flex", flexDirection: "column", flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid #0a1e30" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "10px",
                background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", fontWeight: "700", color: "white",
                fontFamily: "'DM Mono', monospace",
              }}>Æ</div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "#e2e8f0", letterSpacing: "-0.3px" }}>
                  Aegis
                </div>
                <div style={{ fontSize: "10px", color: "#1e3a5f", letterSpacing: "1px", textTransform: "uppercase" }}>
                  local AI
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div style={{ padding: "12px 8px", flex: 1 }}>
            <div style={{ fontSize: "10px", color: "#0d2035", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 10px 8px", fontWeight: 600
}}>
              workspace
            </div>
            {[
              { label: "Chat",     icon: "◈", active: true  },
              { label: "History",  icon: "≡", active: false },
              { label: "Settings", icon: "⌘", active: false },
            ].map(({ label, icon, active }) => (
              <div key={label} className={`nav-item${active ? " active" : ""}`}>
                <span style={{ fontSize: "14px", fontFamily: "'DM Mono', monospace" }}>{icon}</span>
                {label}
              </div>
            ))}
          </div>

          {/* Model selector */}
          {models.length > 0 && (
            <div style={{ padding: "10px 18px", borderTop: "1px solid #0a1e30" }}>
              <div style={{ fontSize: "9.5px", color: "#0d2035", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "6px" }}>
                model
              </div>
              <select
                className="model-select"
                value={activeModel}
                onChange={e => setActiveModel(e.target.value)}
                style={{ width: "100%" }}
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Status */}
          <div style={{
            padding: "14px 18px", borderTop: "1px solid #0a1e30",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: statusColor, display: "inline-block", flexShrink: 0,
              animation: status === "checking" ? "pulse 1s ease-in-out infinite" : status === "online" ? "pulse 3s ease-in-out infinite" : "none",
            }} />
            <span style={{ fontSize: "11px", color: "#1e3a5f", fontFamily: "'DM Mono', monospace" }}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* ── Main area ─────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Header */}
          <div style={{
            padding: "0 24px", height: "56px",
            borderBottom: "1px solid #0a1e30",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#c7d9f0", letterSpacing: "-0.2px" }}>
                Aegis AI
              </span>
              {isActive && (
                <span style={{
                  fontSize: "10.5px", color: "#3b82f6", background: "#060f1c",
                  padding: "2px 9px", borderRadius: "20px", border: "1px solid #1e3a5f",
                  animation: "pulse 1.4s ease-in-out infinite",
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {loading ? "thinking…" : "streaming…"}
                </span>
              )}
              {isRecording && (
                <span style={{
                  fontSize: "10.5px", color: "#ef4444", background: "#1a0a0a",
                  padding: "2px 9px", borderRadius: "20px", border: "1px solid #4b1111",
                  animation: "pulse 1s ease-in-out infinite",
                  fontFamily: "'DM Mono', monospace",
                }}>
                  ● recording…
                </span>
              )}
              {isTranscribing && (
                <span style={{
                  fontSize: "10.5px", color: "#f59e0b", background: "#1a1206",
                  padding: "2px 9px", borderRadius: "20px", border: "1px solid #4b3711",
                  animation: "pulse 1.4s ease-in-out infinite",
                  fontFamily: "'DM Mono', monospace",
                }}>
                  📝 transcribing…
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "#0d2035", fontFamily: "'DM Mono', monospace" }}>
                {chat.length > 0 ? `${Math.ceil(chat.filter(m=>m.sender==="user").length)} msg${chat.filter(m=>m.sender==="user").length !== 1 ? "s" :
""}` : "new session"}
              </span>
              {chat.length > 0 && (
                <button className="icon-btn" onClick={promptClear} title="Clear (Ctrl+L)">
                  clear
                </button>
              )}
            </div>
          </div>

          {/* Chat */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            style={{
              flex: 1, overflowY: "auto",
              padding: "24px 28px",
              display: "flex", flexDirection: "column", gap: "16px",
            }}
          >
            {/* Empty state */}
            {isEmpty && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: "18px", marginTop: "80px",
                animation: "fadeSlideIn 0.4s ease forwards",
              }}>
                <div style={{
                  width: "60px", height: "60px", borderRadius: "18px",
                  background: "linear-gradient(145deg, #0d2258, #1d4ed8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "26px", fontWeight: "700", color: "white",
                  fontFamily: "'DM Mono', monospace",
                  boxShadow: "0 0 48px rgba(29,78,216,0.25)",
                }}>Æ</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "19px", fontWeight: 600, color: "#c7d9f0", marginBottom: "6px" }}>
                    How can I help you?
                  </div>
                  <div style={{ fontSize: "13px", color: "#1e3a5f" }}>
                    Powered by {activeModel} · running locally
                  </div>
                </div>
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: "8px",
                  justifyContent: "center", maxWidth: "520px", marginTop: "4px",
                }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} className="chip" onClick={() => sendMessage(s)}>{s}</button>
                  ))}
                </div>
                <div style={{ fontSize: "11px", color: "#0d2035", fontFamily: "'DM Mono', monospace", marginTop: "4px" }}>
                  ↵ send  ·  ⎋ abort  ·  ⌃L clear  ·  🎤 voice
                </div>
              </div>
            )}

            {/* Messages */}
            {chat.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onCopy={copyMsg}
                onRegenerate={regenerate}
                onSpeak={msg.sender === "ai" ? () => (speaking ? stopSpeaking() : speak(msg.text)) : undefined}
                isSpeaking={speaking}
                isLast={idx === chat.length - 1}
              />
            ))}

            {/* Typing indicator — only while waiting for first token */}
            {loading && !streaming && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                animation: "fadeSlideIn 0.2s ease forwards",
              }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", fontWeight: "700", color: "white",
                  fontFamily: "'DM Mono', monospace", flexShrink: 0, marginTop: "2px",
                }}>Æ</div>
                <div style={{
                  background: "#0a1628", border: "1px solid #1a2e4a",
                  padding: "12px 15px", borderRadius: "18px 18px 18px 4px",
                }}>
                  <TypingDots />
                </div>
              </div>
            )}

            {/* Copied toast */}
            {copied && (
              <div style={{
                position: "fixed", bottom: "90px", left: "50%", transform: "translateX(-50%)",
                background: "#0a2040", border: "1px solid #1e3a5f", color: "#60a5fa",
                padding: "8px 18px", borderRadius: "20px", fontSize: "12px",
                fontFamily: "'DM Mono', monospace", pointerEvents: "none",
                animation: "fadeSlideIn 0.15s ease",
                zIndex: 50,
              }}>✓ copied to clipboard</div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "14px 24px 20px", borderTop: "1px solid #0a1e30", flexShrink: 0 }}>
            <div style={{
              background: "#040e1c", border: "1px solid #1a2e4a",
              borderRadius: "13px", display: "flex", alignItems: "flex-end",
              gap: "8px", padding: "9px 12px",
            }}>
              <textarea
                ref={inputRef}
                value={message}
                onChange={e => { setMessage(e.target.value); resizeTextarea(e.target); }}
                onKeyDown={handleKeyDown}
                placeholder="Message Aegis…  (⏎ send · ⇧⏎ newline · ⎋ abort)"
                rows={1}
                disabled={false}
                style={{
                  flex: 1, background: "transparent", color: "#c7d9f0",
                  border: "none", fontSize: "14px", lineHeight: "1.55",
                  paddingTop: "2px", maxHeight: "160px", overflowY: "auto",
                }}
              />
              {isActive
                ? <button className="abort-btn" onClick={abort} title="Abort (Esc)">■</button>
                : <>
                  <button
                    className={`mic-btn${isRecording ? " active-mic-btn" : ""}`}
                    onClick={toggleRecording}
                    title={
                      isTranscribing ? "Transcribing…" :
                      isRecording ? "Stop recording (Esc)" :
                      "Voice input (click to speak)"
                    }
                    disabled={isTranscribing}
                  >
                    {isTranscribing ? "📝" : isRecording ? "🔴" : "🎤"}
                  </button>
                  {!isRecording && !isTranscribing && (
                    <button className="send-btn" onClick={() => sendMessage()} disabled={!message.trim()} aria-label="Send">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"
strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  )}
                </>
              }
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginTop: "8px", padding: "0 2px",
            }}>
              <span style={{ fontSize: "10.5px", color: "#0d2035", fontFamily: "'DM Mono', monospace" }}>
                all processing is local · nothing leaves your machine
              </span>
              {message.length > 0 && (
                <span style={{ fontSize: "10.5px", color: "#0d2035", fontFamily: "'DM Mono', monospace" }}>
                  {message.length}
                </span>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}