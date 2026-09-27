import React, { useState, useRef, useEffect, useCallback } from "react";
import { VoiceState } from "../voiceController";
import { AegisCore } from "./AegisCore";

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: number;
  streaming?: boolean;
}

interface AegisChatConsoleProps {
  chat: ChatMessage[];
  loading: boolean;
  streaming: boolean;
  searchStatus: string | null;
  actionStatus: string | null;
  activeModel: string;
  voiceState: VoiceState;
  audioEnergy: number;
  isVoiceMode: boolean;
  theme: "dark" | "light";
  speechRate: number;
  isSpeaking: boolean;
  onSendMessage: (text: string) => void;
  onAbort: () => void;
  onToggleVoiceMode: () => void;
  onSwitchToHud: () => void;
  onSpeakText: (text: string) => void;
  onRegenerate: () => void;
  onClearHistory: () => void;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─────────────────────────────────────────────────────────
// Inline Markdown & Code Block Formatter
// ─────────────────────────────────────────────────────────

function InlineFormatter({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} style={{ color: "var(--text-main)", fontWeight: 700 }}>
              {p.slice(2, -2)}
            </strong>
          );
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <code
              key={i}
              style={{
                background: "rgba(0, 240, 255, 0.08)",
                color: "var(--cyan-glow)",
                border: "1px solid rgba(0, 240, 255, 0.25)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "12.5px",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {p.slice(1, -1)}
            </code>
          );
        }
        if (p.startsWith("*") && p.endsWith("*")) {
          return (
            <em key={i} style={{ color: "var(--text-muted)" }}>
              {p.slice(1, -1)}
            </em>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function FormattedContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code Block
    const fence = line.match(/^```(\w*)$/);
    if (fence) {
      const lang = fence[1] || "CODE";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      const code = codeLines.join("\n");
      blocks.push(
        <div
          key={`code-${i}`}
          style={{
            margin: "12px 0",
            borderRadius: "6px",
            overflow: "hidden",
            border: "1px solid rgba(0, 240, 255, 0.22)",
            background: "rgba(2, 6, 16, 0.95)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 12px",
              background: "rgba(0, 240, 255, 0.06)",
              borderBottom: "1px solid rgba(0, 240, 255, 0.15)",
            }}
          >
            <span
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--cyan-glow)",
                letterSpacing: "1px",
              }}
            >
              // {lang.toUpperCase()}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(code)}
              className="hud-btn"
              style={{ padding: "2px 8px", fontSize: "10px" }}
            >
              COPY
            </button>
          </div>
          {/* Code Body */}
          <pre
            style={{
              margin: 0,
              padding: "12px 14px",
              fontSize: "12.5px",
              lineHeight: "1.6",
              color: "#e2e8f0",
              fontFamily: "'DM Mono', monospace",
              overflowX: "auto",
            }}
          >
            <code>{code}</code>
          </pre>
        </div>
      );
      i++;
      continue;
    }

    // Markdown Headings
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h2) {
      blocks.push(
        <h2
          key={i}
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--cyan-glow)",
            fontFamily: "'Orbitron', monospace",
            margin: "14px 0 6px",
            letterSpacing: "0.5px",
          }}
        >
          <InlineFormatter text={h2[1]} />
        </h2>
      );
      i++;
      continue;
    }
    if (h1) {
      blocks.push(
        <h1
          key={i}
          style={{
            fontSize: "17px",
            fontWeight: 800,
            color: "var(--text-main)",
            fontFamily: "'Orbitron', monospace",
            margin: "16px 0 8px",
            letterSpacing: "1px",
          }}
        >
          <InlineFormatter text={h1[1]} />
        </h1>
      );
      i++;
      continue;
    }

    // Bullet item
    if (line.match(/^[-*] .+/)) {
      blocks.push(
        <div key={i} style={{ display: "flex", gap: "8px", margin: "3px 0", paddingLeft: "4px" }}>
          <span style={{ color: "var(--cyan-glow)", fontSize: "12px" }}>◈</span>
          <span style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            <InlineFormatter text={line.replace(/^[-*] /, "")} />
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      blocks.push(<div key={i} style={{ height: "6px" }} />);
      i++;
      continue;
    }

    // Standard line
    blocks.push(
      <p key={i} style={{ margin: "4px 0", color: "var(--text-main)", lineHeight: "1.65" }}>
        <InlineFormatter text={line} />
      </p>
    );
    i++;
  }

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "14px" }}>
      {blocks}
      {streaming && (
        <span
          style={{
            display: "inline-block",
            width: "3px",
            height: "14px",
            backgroundColor: "var(--cyan-glow)",
            marginLeft: "4px",
            verticalAlign: "middle",
            boxShadow: "0 0 8px var(--cyan-glow)",
            animation: "blink 0.6s infinite",
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tactical Message Entry Component
// ─────────────────────────────────────────────────────────

function TacticalMessageEntry({
  msg,
  isLast,
  isSpeaking,
  onSpeak,
  onRegenerate,
  activeModel,
}: {
  msg: ChatMessage;
  isLast: boolean;
  isSpeaking: boolean;
  onSpeak?: () => void;
  onRegenerate?: () => void;
  activeModel: string;
}) {
  const isUser = msg.sender === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        animation: "fadeSlideIn 0.2s ease forwards",
      }}
    >
      {/* Tactical Entry Frame */}
      <div
        className="hud-corner-box aegis-glass-panel"
        style={{
          padding: "14px 18px",
          background: isUser
            ? "linear-gradient(135deg, rgba(2, 132, 199, 0.12), rgba(6, 12, 24, 0.85))"
            : "linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(6, 12, 24, 0.88))",
          border: isUser
            ? "1px solid rgba(0, 240, 255, 0.3)"
            : "1px solid rgba(139, 92, 246, 0.25)",
          boxShadow: isUser
            ? "0 4px 20px rgba(0, 240, 255, 0.08)"
            : "0 4px 24px rgba(139, 92, 246, 0.08)",
          borderRadius: "6px",
        }}
      >
        {/* Entry Header Ribbon */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: isUser
              ? "1px solid rgba(0, 240, 255, 0.15)"
              : "1px solid rgba(139, 92, 246, 0.15)",
            paddingBottom: "8px",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                backgroundColor: isUser ? "var(--cyan-glow)" : "var(--aegis-violet)",
                boxShadow: `0 0 8px ${isUser ? "var(--cyan-glow)" : "var(--aegis-violet)"}`,
              }}
            />
            <span
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1.2px",
                color: isUser ? "var(--text-cyan)" : "var(--cyan-glow)",
              }}
            >
              {isUser ? "OPERATOR // COMMAND" : `AEGIS // NEURAL COGNITION [${activeModel.toUpperCase()}]`}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "10.5px",
                color: "var(--text-muted)",
              }}
            >
              {fmtTime(msg.timestamp)}
            </span>
          </div>
        </div>

        {/* Message Body */}
        {isUser ? (
          <div style={{ display: "flex", gap: "10px", alignItems: "baseline" }}>
            <span
              style={{
                color: "var(--cyan-glow)",
                fontFamily: "'DM Mono', monospace",
                fontWeight: 700,
                fontSize: "14px",
              }}
            >
              &gt;
            </span>
            <p
              style={{
                margin: 0,
                lineHeight: "1.6",
                fontSize: "14px",
                fontFamily: "'Outfit', sans-serif",
                color: "var(--text-main)",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.text}
            </p>
          </div>
        ) : (
          <FormattedContent text={msg.text} streaming={msg.streaming} />
        )}

        {/* Action Toolbar on AI Entries */}
        {!isUser && !msg.streaming && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "8px",
              marginTop: "12px",
              borderTop: "1px solid rgba(0, 240, 255, 0.08)",
              paddingTop: "8px",
            }}
          >
            <button onClick={handleCopy} className="hud-btn" style={{ padding: "3px 8px", fontSize: "10px" }}>
              {copied ? "✓ COPIED" : "📋 COPY"}
            </button>
            {onSpeak && (
              <button
                onClick={onSpeak}
                className={`hud-btn ${isSpeaking ? "active" : ""}`}
                style={{ padding: "3px 8px", fontSize: "10px" }}
              >
                {isSpeaking ? "■ MUTE" : "🔊 SPEAK"}
              </button>
            )}
            {isLast && onRegenerate && (
              <button onClick={onRegenerate} className="hud-btn" style={{ padding: "3px 8px", fontSize: "10px" }}>
                ↺ REGEN
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Master AegisChatConsole Component
// ─────────────────────────────────────────────────────────

export const AegisChatConsole: React.FC<AegisChatConsoleProps> = ({
  chat,
  loading,
  streaming,
  searchStatus,
  actionStatus,
  activeModel,
  voiceState,
  audioEnergy,
  isVoiceMode,
  theme,
  speechRate,
  isSpeaking,
  onSendMessage,
  onAbort,
  onToggleVoiceMode,
  onSwitchToHud,
  onSpeakText,
  onRegenerate,
  onClearHistory,
}) => {
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading, streaming]);

  const handleSend = () => {
    if (!inputMessage.trim() || loading || streaming) return;
    onSendMessage(inputMessage.trim());
    setInputMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickCommands = [
    { label: "⚡ System Diagnostics", query: "Run system diagnostics and show CPU, RAM, and Battery telemetry." },
    { label: "🔊 Set Volume 50%", query: "Set master system volume to 50%." },
    { label: "🌐 Tech News Today", query: "Search the web for the latest artificial intelligence breakthroughs today." },
    { label: "📁 Desktop Files", query: "List files on my desktop." },
  ];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg-deep)",
      }}
    >
      <div className="hud-grid-background" />

      {/* ── Top Ambient Arc Reactor Strip ────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 24px",
          background: "rgba(6, 12, 24, 0.75)",
          borderBottom: "1px solid var(--cyan-border)",
          backdropFilter: "blur(14px)",
          zIndex: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Compact Reactive Arc Reactor Nucleus */}
          <div style={{ width: "64px", height: "64px", flexShrink: 0, marginTop: "-4px" }}>
            <AegisCore
              voiceState={voiceState}
              audioEnergy={audioEnergy}
              isVoiceMode={isVoiceMode}
              theme={theme}
              onCoreClick={onToggleVoiceMode}
              size={64}
            />
          </div>

          <div>
            <div
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: "14px",
                fontWeight: 800,
                color: "var(--text-main)",
                letterSpacing: "1.5px",
              }}
            >
              AEGIS COMMAND CONSOLE
            </div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "11px",
                color: "var(--text-muted)",
                marginTop: "2px",
              }}
            >
              AIRGAP CORE // MODEL: {activeModel} // {isVoiceMode ? "VOICE ARMED" : "MANUAL MODE"}
            </div>
          </div>
        </div>

        {/* Top Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={onSwitchToHud} className="hud-btn" style={{ padding: "6px 14px", fontSize: "11px" }}>
            <span>◈ HOLOGRAPHIC HUD (TAB)</span>
          </button>
          <button
            onClick={onToggleVoiceMode}
            className={`hud-btn ${isVoiceMode ? "active" : ""}`}
            style={{ padding: "6px 12px", fontSize: "11px" }}
          >
            <span>{isVoiceMode ? "● VOICE ACTIVE" : "🎙 START VOICE MODE"}</span>
          </button>
          <button onClick={onClearHistory} className="hud-btn" style={{ padding: "6px 10px", fontSize: "11px" }}>
            <span>PURGE LOGS</span>
          </button>
        </div>
      </div>

      {/* ── Main Message Scroll Stream ───────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          zIndex: 2,
        }}
      >
        {chat.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              margin: "60px 0",
            }}
          >
            <div
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-cyan)",
                letterSpacing: "1px",
              }}
            >
              TACTICAL NEURAL CHAT INITIALIZED
            </div>
            <p
              style={{
                fontFamily: "'Outfit', sans-serif",
                color: "var(--text-muted)",
                fontSize: "14px",
                maxWidth: "460px",
                textAlign: "center",
                lineHeight: "1.6",
              }}
            >
              Direct neural link established with local Ollama engine. Execute commands, ask deep questions, or control PC systems.
            </p>
          </div>
        )}

        {chat.map((msg, idx) => (
          <TacticalMessageEntry
            key={msg.id}
            msg={msg}
            isLast={idx === chat.length - 1}
            isSpeaking={isSpeaking}
            onSpeak={msg.sender === "ai" ? () => onSpeakText(msg.text) : undefined}
            onRegenerate={onRegenerate}
            activeModel={activeModel}
          />
        ))}

        {/* Live Action or Thinking Telemetry Entry */}
        {(loading || actionStatus || searchStatus) && !streaming && (
          <div
            className="hud-corner-box aegis-glass-panel"
            style={{
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              border: "1px solid var(--cyan-border)",
              background: "rgba(6, 12, 24, 0.8)",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--cyan-glow)",
                boxShadow: "0 0 10px var(--cyan-glow)",
                animation: "blink 0.7s infinite",
              }}
            />
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "13px",
                color: actionStatus ? "var(--amber-warn)" : "var(--text-cyan)",
                animation: "textShimmer 1.6s infinite",
              }}
            >
              {actionStatus ? `⚡ ${actionStatus}` : searchStatus ? `🌐 ${searchStatus}` : "◈ Computing neural inference..."}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Action Suggestion Chips ────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "6px 28px",
          overflowX: "auto",
          background: "rgba(3, 7, 18, 0.7)",
          borderTop: "1px solid rgba(0, 240, 255, 0.08)",
          zIndex: 3,
        }}
      >
        {quickCommands.map((qc, i) => (
          <button
            key={i}
            onClick={() => onSendMessage(qc.query)}
            style={{
              background: "rgba(0, 240, 255, 0.05)",
              border: "1px solid rgba(0, 240, 255, 0.2)",
              color: "var(--text-cyan)",
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 600,
              letterSpacing: "0.5px",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {qc.label}
          </button>
        ))}
      </div>

      {/* ── Input Action Capsule ─────────────────────────── */}
      <div
        style={{
          padding: "14px 28px 20px",
          borderTop: "1px solid var(--cyan-border)",
          background: "var(--bg-header)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 4,
        }}
      >
        <div
          className="hud-corner-box aegis-glass-panel"
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "10px",
            padding: "10px 14px",
            border: `1px solid ${
              voiceState === "RECORDING"
                ? "var(--red-hazard)"
                : isVoiceMode
                ? "var(--cyan-glow)"
                : "var(--cyan-border)"
            }`,
            boxShadow: isVoiceMode ? "0 0 16px var(--shadow-glow)" : "none",
          }}
        >
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--cyan-glow)",
              paddingBottom: "4px",
            }}
          >
            AEGIS:~$
          </span>

          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={e => {
              setInputMessage(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              voiceState === "RECORDING"
                ? "Capturing voice stream... speak freely"
                : isVoiceMode
                ? "Voice Mode Active · speak freely or type command…"
                : "Enter command or query… (⏎ Send · ⇧⏎ Newline · Tab HUD)"
            }
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              color: "var(--text-main)",
              border: "none",
              fontSize: "14px",
              lineHeight: "1.55",
              maxHeight: "140px",
              outline: "none",
              fontFamily: "'Outfit', sans-serif",
              resize: "none",
            }}
          />

          {loading || streaming || isSpeaking ? (
            <button onClick={onAbort} className="hud-btn hud-btn-danger" style={{ padding: "6px 12px" }}>
              ■ ABORT (ESC)
            </button>
          ) : (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={onToggleVoiceMode}
                className={`hud-btn ${voiceState === "RECORDING" ? "hud-btn-danger" : ""}`}
                style={{ padding: "6px 12px" }}
              >
                {voiceState === "RECORDING" ? "● RECORDING" : "🎤 VOICE"}
              </button>
              <button
                onClick={handleSend}
                disabled={!inputMessage.trim()}
                className="hud-btn"
                style={{ padding: "6px 14px" }}
              >
                EXECUTE ↵
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "8px",
            fontSize: "10px",
            color: "var(--text-muted)",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          <span>AEGIS SYSTEM // AIRGAP LOCAL RUNTIME // 1.70x TTS ACTIVE</span>
          <span>{inputMessage.length > 0 ? `${inputMessage.length} CHARS` : "READY"}</span>
        </div>
      </div>
    </div>
  );
};
