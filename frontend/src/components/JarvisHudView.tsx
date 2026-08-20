import React from "react";
import { JarvisCore } from "./JarvisCore";
import { HudTelemetry } from "./HudTelemetry";
import { VoiceState } from "../voiceController";

interface JarvisHudViewProps {
  voiceState: VoiceState;
  audioEnergy: number;
  isVoiceMode: boolean;
  activeModel: string;
  backendStatus: "online" | "offline" | "checking";
  messageCount: number;
  audioCuesEnabled: boolean;
  theme: "dark" | "light";
  lastUserMessage?: string;
  lastAiMessage?: string;
  isStreaming: boolean;
  isLoading: boolean;
  onToggleVoiceMode: () => void;
  onToggleAudioCues: () => void;
  onSendPrompt: (text: string) => void;
  onAbort: () => void;
  onSwitchToTerminal: () => void;
}

const QUICK_PROMPTS = [
  "Run system diagnostics",
  "Explain quantum computing",
  "Write an async Python web scraper",
  "What is the Fermi paradox?",
  "Summarize active local capabilities",
];

export const JarvisHudView: React.FC<JarvisHudViewProps> = ({
  voiceState,
  audioEnergy,
  isVoiceMode,
  activeModel,
  backendStatus,
  messageCount,
  audioCuesEnabled,
  theme,
  lastUserMessage,
  lastAiMessage,
  isStreaming,
  isLoading,
  onToggleVoiceMode,
  onToggleAudioCues,
  onSendPrompt,
  onAbort,
  onSwitchToTerminal,
}) => {
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
      {/* Background Holographic Grid & Scanlines */}
      <div className="hud-grid-background" />
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
          marginTop: "-30px",
        }}
      >
        <JarvisCore
          voiceState={voiceState}
          audioEnergy={audioEnergy}
          isVoiceMode={isVoiceMode}
          theme={theme}
          onCoreClick={onToggleVoiceMode}
          size={360}
        />

        {/* Live Mini Spectrum Audio Waveform Bar (Super Animation) */}
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

      {/* ── Bottom Floating Holographic Subtitles & Transcript ── */}
      <div
        style={{
          position: "absolute",
          bottom: "28px",
          width: "calc(100% - 580px)",
          maxWidth: "760px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          zIndex: 4,
        }}
      >
        {/* Live Subtitle Transcript Ribbon */}
        {(lastUserMessage || lastAiMessage || isLoading || isStreaming) && (
          <div
            className="hud-corner-box"
            style={{
              width: "100%",
              padding: "12px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              maxHeight: "130px",
              overflowY: "auto",
              boxShadow: "0 0 20px var(--shadow-glow)",
            }}
          >
            {lastUserMessage && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: "10px",
                    color: "var(--text-cyan)",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    flexShrink: 0,
                  }}
                >
                  USER //
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontFamily: "'Outfit', sans-serif" }}>
                  {lastUserMessage}
                </span>
              </div>
            )}

            {(lastAiMessage || isLoading || isStreaming) && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  borderTop: lastUserMessage ? "1px solid var(--cyan-border)" : "none",
                  paddingTop: lastUserMessage ? "6px" : "0",
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
                <span style={{ fontSize: "13px", color: "var(--text-main)", fontFamily: "'Outfit', sans-serif", lineHeight: "1.4" }}>
                  {isLoading && !isStreaming ? (
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

        {/* Quick Voice Command Chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSendPrompt(prompt)}
              className="hud-btn"
              style={{ fontSize: "11px", padding: "5px 12px", borderRadius: "18px" }}
            >
              <span>{prompt}</span>
            </button>
          ))}
        </div>

        {/* Bottom HUD Controls */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "2px" }}>
          {voiceState === "SPEAKING" || isLoading || isStreaming ? (
            <button onClick={onAbort} className="hud-btn hud-btn-danger">
              <span>■ INTERRUPT / STOP (ESC)</span>
            </button>
          ) : (
            <button
              onClick={onToggleVoiceMode}
              className={`hud-btn ${isVoiceMode ? "active" : ""}`}
            >
              <span>{isVoiceMode ? "● VOICE ACTIVE" : "🎙 START VOICE MODE"}</span>
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
