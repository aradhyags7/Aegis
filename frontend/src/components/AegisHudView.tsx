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
          bottom: "32px",
          width: "calc(100% - 580px)",
          maxWidth: "760px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "14px",
          zIndex: 4,
        }}
      >
        {/* Live Subtitle Transcript Ribbon */}
        {(displayedUserText || lastAiMessage || isLoading || isStreaming || isRecording || searchStatus || actionStatus) && (
          <div
            className="hud-corner-box"
            style={{
              width: "100%",
              padding: "14px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "150px",
              overflowY: "auto",
              boxShadow: "0 0 24px var(--shadow-glow)",
              border: isRecording ? "1px solid var(--red-hazard)" : actionStatus ? "1px solid var(--amber-warn)" : "1px solid var(--cyan-border)",
            }}
          >
            {/* Live PC Action Alert */}
            {actionStatus && (
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: "10px",
                    color: "var(--amber-warn)",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    flexShrink: 0,
                  }}
                >
                  PC ACTION //
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--amber-warn)",
                    fontFamily: "'DM Mono', monospace",
                    animation: "textShimmer 1.6s infinite",
                  }}
                >
                  ⚡ {actionStatus}
                </span>
              </div>
            )}

            {/* Live Search Status Alert */}
            {searchStatus && (
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: "10px",
                    color: "var(--cyan-glow)",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    flexShrink: 0,
                  }}
                >
                  LIVE WEB //
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-cyan)",
                    fontFamily: "'DM Mono', monospace",
                    animation: "textShimmer 1.6s infinite",
                  }}
                >
                  🌐 {searchStatus}
                </span>
              </div>
            )}

            {/* Real-time live transcribing speech ribbon */}
            {(isRecording || displayedUserText) && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: "10px",
                    color: isRecording ? "var(--red-hazard)" : "var(--text-cyan)",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    flexShrink: 0,
                  }}
                >
                  {isRecording ? "LIVE SPEECH //" : "USER //"}
                </span>
                <span
                  style={{
                    fontSize: "13.5px",
                    color: isRecording ? "var(--text-main)" : "var(--text-secondary)",
                    fontFamily: "'Outfit', sans-serif",
                    lineHeight: "1.4",
                  }}
                >
                  {displayedUserText}
                  {isRecording && (
                    <span
                      style={{
                        display: "inline-block",
                        width: "6px",
                        height: "12px",
                        background: "var(--red-hazard)",
                        marginLeft: "4px",
                        animation: "blink 0.6s infinite",
                      }}
                    />
                  )}
                </span>
              </div>
            )}

            {/* AI Real-time streaming response */}
            {(lastAiMessage || isLoading || isStreaming || voiceState === "TRANSCRIBING" || voiceState === "THINKING") && !isRecording && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  borderTop: (displayedUserText || searchStatus) ? "1px solid var(--cyan-border)" : "none",
                  paddingTop: (displayedUserText || searchStatus) ? "6px" : "0",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: "10px",
                    color: "var(--cyan-glow)",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    flexShrink: 0,
                  }}
                >
                  AEGIS //
                </span>
                <span style={{ fontSize: "13.5px", color: "var(--text-main)", fontFamily: "'Outfit', sans-serif", lineHeight: "1.4" }}>
                  {voiceState === "TRANSCRIBING" ? (
                    <span style={{ color: "var(--amber-warn)", animation: "textShimmer 1.5s infinite" }}>
                      📝 Transcribing with Faster-Whisper…
                    </span>
                  ) : isLoading && !isStreaming ? (
                    <span style={{ color: "var(--text-cyan)", animation: "textShimmer 1.8s infinite" }}>
                      ◈ Synthesizing neural response…
                    </span>
                  ) : (
                    lastAiMessage
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
        )}

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
