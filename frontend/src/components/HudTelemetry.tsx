import React, { useEffect, useState } from "react";
import { VoiceState } from "../voiceController";

interface HudTelemetryProps {
  activeModel: string;
  backendStatus: "online" | "offline" | "checking";
  voiceState: VoiceState;
  audioEnergy: number;
  messageCount: number;
  audioCuesEnabled: boolean;
  theme?: "dark" | "light";
  onToggleAudioCues: () => void;
  onToggleVoiceMode: () => void;
  isVoiceMode: boolean;
}

export const HudTelemetry: React.FC<HudTelemetryProps> = ({
  activeModel,
  backendStatus,
  voiceState,
  audioEnergy,
  messageCount,
  audioCuesEnabled,
  theme = "dark",
  onToggleAudioCues,
  onToggleVoiceMode,
  isVoiceMode,
}) => {
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  const isLight = theme === "light";

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hr = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      const sec = String(d.getSeconds()).padStart(2, "0");

      setDateStr(`${yr}.${mo}.${day}`);
      setTimeStr(`${hr}:${min}:${sec}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const rmsDb = Math.round(audioEnergy * 100);

  return (
    <div
      style={{
        position: "absolute",
        inset: "64px 24px 24px 24px",
        display: "flex",
        justifyContent: "space-between",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      {/* ── Left Telemetry Card (System Diagnostics) ──── */}
      <div
        className="hud-corner-box"
        style={{
          width: "260px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          pointerEvents: "auto",
          alignSelf: "flex-start",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: isLight ? "1px solid rgba(2, 132, 199, 0.2)" : "1px solid rgba(0, 240, 255, 0.15)",
            paddingBottom: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: isLight ? "#0284c7" : "#00f0ff",
                boxShadow: isLight ? "0 0 6px #0284c7" : "0 0 8px #00f0ff",
              }}
            />
            <span
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1px",
                color: "var(--text-cyan)",
              }}
            >
              SYS_DIAGNOSTICS
            </span>
          </div>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-muted)" }}>
            [01]
          </span>
        </div>

        {/* Live HUD Clock */}
        <div
          style={{
            background: isLight ? "rgba(2, 132, 199, 0.06)" : "rgba(0, 240, 255, 0.04)",
            border: isLight ? "1px solid rgba(2, 132, 199, 0.2)" : "1px solid rgba(0, 240, 255, 0.15)",
            padding: "8px 10px",
            borderRadius: "4px",
          }}
        >
          <div
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "10px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            STARK STAMP // LOCAL
          </div>
          <div
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--text-main)",
              letterSpacing: "1px",
              marginTop: "2px",
            }}
          >
            {dateStr} <span style={{ color: "var(--text-cyan)" }}>{timeStr}</span>
          </div>
        </div>

        {/* Neural Core Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11.5px", fontFamily: "'Rajdhani', sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>NEURAL_ENGINE:</span>
            <span style={{ color: "var(--text-cyan)", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{activeModel}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>LLM_BACKEND:</span>
            <span style={{ color: backendStatus === "online" ? "var(--green-online)" : "var(--red-hazard)", fontWeight: 600 }}>
              {backendStatus === "online" ? "ONLINE [OLLAMA]" : "OFFLINE"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>SPEECH_RECOGNITION:</span>
            <span style={{ color: "var(--text-cyan)", fontWeight: 600 }}>FASTER-WHISPER</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>VOICE_SYNTHESIS:</span>
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>ELECTRON TTS</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>SESSION_MEMORY:</span>
            <span style={{ color: "var(--text-main)", fontFamily: "'DM Mono', monospace" }}>{messageCount} TURNS</span>
          </div>
        </div>

        {/* Protocol Security Clearance */}
        <div
          style={{
            borderTop: isLight ? "1px solid rgba(2, 132, 199, 0.2)" : "1px solid rgba(0, 240, 255, 0.15)",
            paddingTop: "8px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "9.5px", fontFamily: "'Orbitron', monospace", color: "var(--green-online)", letterSpacing: "1px" }}>
            🛡 PROTOCOL: AIRGAPPED LOCAL
          </span>
        </div>
      </div>

      {/* ── Right Telemetry Card (Acoustic & VAD Telemetry) ── */}
      <div
        className="hud-corner-box"
        style={{
          width: "260px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          pointerEvents: "auto",
          alignSelf: "flex-start",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: isLight ? "1px solid rgba(2, 132, 199, 0.2)" : "1px solid rgba(0, 240, 255, 0.15)",
            paddingBottom: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: isVoiceMode ? "var(--cyan-glow)" : "var(--text-muted)",
                boxShadow: isVoiceMode ? "0 0 8px var(--cyan-glow)" : "none",
              }}
            />
            <span
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1px",
                color: "var(--text-cyan)",
              }}
            >
              ACOUSTIC_VAD
            </span>
          </div>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-muted)" }}>
            [02]
          </span>
        </div>

        {/* Audio Energy RMS Gauge */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontFamily: "'Rajdhani', sans-serif" }}>
            <span style={{ color: "var(--text-muted)" }}>MIC_INPUT_ENERGY:</span>
            <span
              style={{
                color: rmsDb > 25 ? "var(--red-hazard)" : "var(--text-cyan)",
                fontFamily: "'DM Mono', monospace",
                fontWeight: 600,
              }}
            >
              {rmsDb} dB
            </span>
          </div>
          <div
            style={{
              height: "6px",
              background: isLight ? "rgba(2, 132, 199, 0.12)" : "rgba(0, 240, 255, 0.1)",
              borderRadius: "3px",
              overflow: "hidden",
              border: "1px solid var(--cyan-border)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, rmsDb * 2)}%`,
                background: rmsDb > 25 ? "linear-gradient(90deg, #00f0ff, #ef4444)" : "linear-gradient(90deg, #0284c7, #00f0ff)",
                boxShadow: "0 0 8px var(--cyan-glow)",
                transition: "width 0.05s ease",
              }}
            />
          </div>
        </div>

        {/* VAD & Barge-in details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11.5px", fontFamily: "'Rajdhani', sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>VOICE_STATE:</span>
            <span
              style={{
                color: voiceState === "RECORDING" ? "var(--red-hazard)" : voiceState === "SPEAKING" ? "var(--cyan-glow)" : "var(--text-cyan)",
                fontWeight: 600,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {voiceState}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>AUTO_SILENCE_CUTOFF:</span>
            <span style={{ color: "var(--green-online)", fontWeight: 600 }}>1300 ms [ARMED]</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>BARGE_IN_OVERRIDE:</span>
            <span style={{ color: "var(--green-online)", fontWeight: 600 }}>ENABLED [0ms]</span>
          </div>
        </div>

        {/* Quick Voice Controls */}
        <div
          style={{
            borderTop: isLight ? "1px solid rgba(2, 132, 199, 0.2)" : "1px solid rgba(0, 240, 255, 0.15)",
            paddingTop: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <button
            onClick={onToggleVoiceMode}
            className={`hud-btn ${isVoiceMode ? "active" : ""}`}
            style={{ width: "100%", justifyContent: "center" }}
          >
            <span>{isVoiceMode ? "● VOICE ACTIVE" : "○ START VOICE MODE"}</span>
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontFamily: "'Rajdhani', sans-serif", color: "var(--text-muted)" }}>
              ACOUSTIC_CUES
            </span>
            <button
              onClick={onToggleAudioCues}
              style={{
                background: audioCuesEnabled ? "var(--cyan-hover)" : "transparent",
                border: "1px solid var(--cyan-border)",
                color: audioCuesEnabled ? "var(--text-cyan)" : "var(--text-muted)",
                fontSize: "10px",
                fontFamily: "'DM Mono', monospace",
                padding: "2px 8px",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              {audioCuesEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
