import React from "react";
import { AegisCore } from "./AegisCore";
import { HudTelemetry } from "./HudTelemetry";
import { VoiceState } from "../voiceController";

interface AegisHudViewProps {
  voiceState: VoiceState;
  audioEnergy: number;
  isVoiceMode: boolean;
  activeModel: string;
  backendStatus: "online" | "offline" | "checking";
  messageCount: number;
  audioCuesEnabled: boolean;
  theme: "dark" | "light";
  liveTranscript?: string;
  searchStatus?: string | null;
  actionStatus?: string | null;
  lastUserMessage?: string;
  lastAiMessage?: string;
  isStreaming: boolean;
  isLoading: boolean;
  onToggleVoiceMode: () => void;
  onToggleAudioCues: () => void;
  onAbort: () => void;
  onSwitchToTerminal: () => void;
}

export const AegisHudView: React.FC<AegisHudViewProps> = ({
  voiceState,
  audioEnergy,
  isVoiceMode,
  activeModel,
  backendStatus,
  messageCount,
  audioCuesEnabled,
  theme,
  liveTranscript,
  searchStatus,
  actionStatus,
  lastUserMessage,
  lastAiMessage,
  isStreaming,
  isLoading,
  onToggleVoiceMode,
  onToggleAudioCues,
  onAbort,
  onSwitchToTerminal,
}) => {
  const isRecording = voiceState === "RECORDING";
  const displayedUserText = isRecording
    ? (liveTranscript || "Listening to speech…")
    : (lastUserMessage || liveTranscript);

  // Dynamic 50% viewport scale calculation (Core orb occupies roughly 50% of the screen/space)
  const [coreSize, setCoreSize] = React.useState(() => {
    if (typeof window !== "undefined") {
      const minDim = Math.min(window.innerWidth, window.innerHeight);
      return Math.max(320, Math.min(Math.round(minDim * 0.50), 520));
    }
    return 380;
  });

  React.useEffect(() => {
    const handleResize = () => {
      const minDim = Math.min(window.innerWidth, window.innerHeight);
      setCoreSize(Math.max(320, Math.min(Math.round(minDim * 0.50), 520)));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Background Holographic Grid, Radar Sweep & Scanlines */}
      <div className="hud-grid-background" />
      <div className="hud-radar-sweep" />
      <div className="hud-scanlines" />
      <div className="hud-vignette" />

      {/* Flanking Telemetry HUD Cards */}
      <HudTelemetry
        activeModel={activeModel}
        backendStatus={backendStatus}
        voiceState={voiceState}
        audioEnergy={audioEnergy}
        messageCount={messageCount}
        audioCuesEnabled={audioCuesEnabled}
        theme={theme}
        onToggleAudioCues={onToggleAudioCues}
        onToggleVoiceMode={onToggleVoiceMode}
        isVoiceMode={isVoiceMode}
      />

      {/* Center AI Arc Reactor Core */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "-20px",
        }}
      >
        <AegisCore
          voiceState={voiceState}
          audioEnergy={audioEnergy}
          isVoiceMode={isVoiceMode}
          theme={theme}
          onCoreClick={onToggleVoiceMode}
          size={coreSize}
        />

        {/* Live Mini Spectrum Audio Waveform Bar */}
        {(voiceState === "RECORDING" || voiceState === "SPEAKING" || audioEnergy > 0) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              height: "20px",
              marginTop: "44px",
              padding: "4px 14px",
              background: "var(--bg-card)",
              border: "1px solid var(--cyan-border)",
              borderRadius: "12px",
              animation: "fadeSlideIn 0.2s ease",
            }}
          >
            {[0.3, 0.6, 0.9, 1.0, 0.8, 0.5, 0.9, 1.2, 0.7, 0.4, 0.8, 1.0, 0.6, 0.3].map((mult, idx) => (
              <span
                key={idx}
                style={{
                  width: "3px",
                  height: `${Math.max(4, Math.min(18, (audioEnergy || 0.15) * 22 * mult))}px`,
                  backgroundColor: voiceState === "RECORDING" ? "var(--red-hazard)" : "var(--cyan-glow)",
                  borderRadius: "2px",
                  boxShadow: `0 0 6px ${voiceState === "RECORDING" ? "var(--red-hazard)" : "var(--cyan-glow)"}`,
                  transition: "height 0.04s ease",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom Floating Real-Time Subtitles & Transcript ── */}
      <div
        style={{
          position: "absolute",
          bottom: "24px",
          width: "min(92%, 720px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          zIndex: 4,
        }}
      >
        {/* Permanent Stable HUD Communication Console (Zero-Flicker Architecture) */}
        <div
          className="hud-corner-box aegis-glass-panel"
          style={{
            width: "100%",
            minHeight: "84px",
            maxHeight: "140px",
            padding: "12px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            overflowY: "auto",
            background: "rgba(6, 12, 24, 0.78)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            boxShadow: isRecording
              ? "0 8px 32px rgba(239, 68, 68, 0.25), 0 0 20px rgba(239, 68, 68, 0.4)"
              : voiceState === "TRANSCRIBING"
              ? "0 8px 32px rgba(245, 158, 11, 0.2), 0 0 20px rgba(245, 158, 11, 0.35)"
              : "0 8px 32px rgba(0, 0, 0, 0.6), 0 0 24px var(--shadow-glow)",
            border: isRecording
              ? "1px solid var(--red-hazard)"
              : voiceState === "TRANSCRIBING"
              ? "1px solid var(--amber-warn)"
              : actionStatus
              ? "1px solid var(--amber-warn)"
              : "1px solid var(--cyan-border)",
            transition: "border 0.25s ease, box-shadow 0.25s ease",
          }}
        >
          {/* Header Row: Live State Status Indicator */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(0, 240, 255, 0.12)",
              paddingBottom: "5px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: isRecording
                    ? "var(--red-hazard)"
                    : voiceState === "TRANSCRIBING"
                    ? "var(--amber-warn)"
                    : isStreaming || isLoading
                    ? "var(--cyan-glow)"
                    : "var(--cyan-border-active)",
                  boxShadow: `0 0 8px ${
                    isRecording
                      ? "var(--red-hazard)"
                      : voiceState === "TRANSCRIBING"
                      ? "var(--amber-warn)"
                      : "var(--cyan-glow)"
                  }`,
                  animation: isRecording || isStreaming ? "blink 0.8s infinite" : "none",
                }}
              />
              <span
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  color: isRecording
                    ? "var(--red-hazard)"
                    : voiceState === "TRANSCRIBING"
                    ? "var(--amber-warn)"
                    : "var(--text-cyan)",
                }}
              >
                {isRecording
                  ? "VOICE_INPUT // CAPTURING SPEECH STREAM"
                  : voiceState === "TRANSCRIBING"
                  ? "NEURAL_DECODE // FASTER-WHISPER LOCAL PASS"
                  : actionStatus
                  ? "HOST_PC // EXECUTING SYSTEM COMMAND"
                  : searchStatus
                  ? "TIME_AWARE_WEB // INTERNET SEARCH"
                  : isLoading && !isStreaming
                  ? "NEURAL_SYNTHESIS // COMPUTING RESPONSE"
                  : isStreaming
                  ? "TRANSMITTING // STREAMING RESPONSE"
                  : lastAiMessage
                  ? "AEGIS // READY"
                  : "AEGIS PROTOCOL // READY"}
              </span>
            </div>

            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "9.5px",
                color: "var(--text-muted)",
                letterSpacing: "0.5px",
              }}
            >
              {isRecording
                ? `MIC GAIN: ${Math.round(audioEnergy * 100)}%`
                : activeModel}
            </span>
          </div>

          {/* Dynamic Content Display */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {/* Live PC Action Notification */}
            {actionStatus && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "12.5px",
                    color: "var(--amber-warn)",
                    fontFamily: "'DM Mono', monospace",
                    animation: "textShimmer 1.6s infinite",
                  }}
                >
                  ⚡ {actionStatus}
                </span>
              </div>
            )}

            {/* Live Search Notification */}
            {searchStatus && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "12.5px",
                    color: "var(--text-cyan)",
                    fontFamily: "'DM Mono', monospace",
                    animation: "textShimmer 1.6s infinite",
                  }}
                >
                  🌐 {searchStatus}
                </span>
              </div>
            )}

            {/* State: Recording */}
            {isRecording && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-main)",
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  Listening for voice input... speak freely or pause to finish.
                </span>
              </div>
            )}

            {/* State: Transcribing */}
            {voiceState === "TRANSCRIBING" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--amber-warn)",
                    fontFamily: "'DM Mono', monospace",
                    animation: "textShimmer 1.4s infinite",
                  }}
                >
                  ⚡ Decoding audio buffer with Faster-Whisper...
                </span>
              </div>
            )}

            {/* State: User Message History (if not actively recording/transcribing) */}
            {!isRecording && voiceState !== "TRANSCRIBING" && lastUserMessage && (
              <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: "9.5px",
                    color: "var(--text-cyan)",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    flexShrink: 0,
                  }}
                >
                  USER:
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    fontFamily: "'Outfit', sans-serif",
                    lineHeight: "1.4",
                  }}
                >
                  {lastUserMessage}
                </span>
              </div>
            )}

            {/* State: AI Response / Neural Generation */}
            {!isRecording && voiceState !== "TRANSCRIBING" && (
              <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: "9.5px",
                    color: "var(--cyan-glow)",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    flexShrink: 0,
                  }}
                >
                  AEGIS:
                </span>
                <span
                  style={{
                    fontSize: "13.5px",
                    color: "var(--text-main)",
                    fontFamily: "'Outfit', sans-serif",
                    lineHeight: "1.4",
                  }}
                >
                  {isLoading && !isStreaming ? (
                    <span style={{ color: "var(--text-cyan)", animation: "textShimmer 1.8s infinite" }}>
                      ◈ Synthesizing neural response…
                    </span>
                  ) : lastAiMessage ? (
                    lastAiMessage
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>
                      Standing by. Click core, use voice mode (Ctrl+M), or press Tab for terminal.
                    </span>
                  )}
                  {isStreaming && (
                    <span
                      style={{
                        display: "inline-block",
                        width: "6px",
                        height: "12px",
                        background: "var(--cyan-glow)",
                        marginLeft: "4px",
                        animation: "blink 0.7s infinite",
                      }}
                    />
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom HUD Controls (Clean & Minimalist) */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {voiceState === "SPEAKING" || isLoading || isStreaming ? (
            <button onClick={onAbort} className="hud-btn hud-btn-danger">
              <span>■ INTERRUPT / STOP (ESC)</span>
            </button>
          ) : (
            <button
              onClick={onToggleVoiceMode}
              className={`hud-btn ${isVoiceMode ? "active" : ""}`}
            >
              <span>{isVoiceMode ? "● VOICE MODE ACTIVE" : "🎙 START VOICE MODE"}</span>
            </button>
          )}

          <button onClick={onSwitchToTerminal} className="hud-btn">
            <span>≡ OPEN COMMAND TERMINAL (TAB)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
