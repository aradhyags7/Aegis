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

interface SystemTelemetry {
  cpu_percent?: number;
  ram_percent?: number;
  battery_percent?: number | null;
  battery_plugged?: boolean | null;
  uptime_formatted?: string;
  hostname?: string;
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
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);

  const isLight = theme === "light";

  // Clock
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

  // Poll Hardware Telemetry
  useEffect(() => {
    let mounted = true;
    const fetchTelemetry = async () => {
      try {
        const res = await fetch("http://localhost:8000/system/telemetry");
        if (res.ok && mounted) {
          const data = await res.json();
          setTelemetry(data);
        }
      } catch {
        /* ignore if offline */
      }
    };
    fetchTelemetry();
    const t = setInterval(fetchTelemetry, 6000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const rmsDb = Math.round(audioEnergy * 100);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
        overflow: "hidden",
      }}
    >
      {/* ── TOP-LEFT: [01] SYS_DIAGNOSTICS ────────────────── */}
      <div
        className="hud-corner-box aegis-glass-panel"
        style={{
          position: "absolute",
          top: "64px",
          left: "24px",
          width: "260px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          pointerEvents: "auto",
        }}
      >
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
                background: isLight ? "#0284c7" : "var(--aegis-cyan)",
                boxShadow: "0 0 8px var(--aegis-cyan)",
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
            AEGIS STAMP // LOCAL
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
            <span style={{ color: "var(--text-muted)" }}>SESSION_TURNS:</span>
            <span style={{ color: "var(--text-main)", fontFamily: "'DM Mono', monospace" }}>{messageCount} TURNS</span>
          </div>
        </div>

        {/* Security Clearance */}
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

      {/* ── TOP-RIGHT: [02] ACOUSTIC_VAD ───────────────── */}
      <div
        className="hud-corner-box aegis-glass-panel"
        style={{
          position: "absolute",
          top: "64px",
          right: "24px",
          width: "260px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          pointerEvents: "auto",
        }}
      >
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
            <span style={{ color: "var(--green-online)", fontWeight: 600 }}>650 ms [ARMED]</span>
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

      {/* ── BOTTOM-LEFT: [03] HARDWARE_STATUS ──────────── */}
      <div
        className="hud-corner-box aegis-glass-panel"
        style={{
          position: "absolute",
          bottom: "24px",
          left: "24px",
          width: "260px",
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: isLight ? "1px solid rgba(2, 132, 199, 0.2)" : "1px solid rgba(0, 240, 255, 0.15)",
            paddingBottom: "6px",
          }}
        >
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: "10.5px", fontWeight: 700, color: "var(--text-cyan)", letterSpacing: "1px" }}>
            HARDWARE_STATUS
          </span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-muted)" }}>
            [03]
          </span>
        </div>

        {/* CPU & RAM Bar Gauges */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontFamily: "'Rajdhani', sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>CPU_LOAD:</span>
            <span style={{ color: (telemetry?.cpu_percent ?? 12) > 80 ? "var(--red-hazard)" : "var(--text-cyan)", fontFamily: "'DM Mono', monospace" }}>
              {telemetry?.cpu_percent ?? "--"}%
            </span>
          </div>
          <div style={{ height: "4px", background: "rgba(0,240,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${telemetry?.cpu_percent ?? 15}%`, background: "var(--cyan-glow)", transition: "width 0.3s ease" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
            <span style={{ color: "var(--text-muted)" }}>RAM_UTILIZATION:</span>
            <span style={{ color: "var(--text-cyan)", fontFamily: "'DM Mono', monospace" }}>
              {telemetry?.ram_percent ?? "--"}%
            </span>
          </div>
          <div style={{ height: "4px", background: "rgba(0,240,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${telemetry?.ram_percent ?? 45}%`, background: "var(--blue-core)", transition: "width 0.3s ease" }} />
          </div>

          {telemetry?.battery_percent !== null && telemetry?.battery_percent !== undefined && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
              <span style={{ color: "var(--text-muted)" }}>BATTERY_LEVEL:</span>
              <span style={{ color: telemetry.battery_percent > 20 ? "var(--green-online)" : "var(--amber-warn)", fontFamily: "'DM Mono', monospace" }}>
                {telemetry.battery_percent}% {telemetry.battery_plugged ? "⚡" : ""}
              </span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
            <span style={{ color: "var(--text-muted)" }}>SYSTEM_UPTIME:</span>
            <span style={{ color: "var(--text-main)", fontFamily: "'DM Mono', monospace" }}>
              {telemetry?.uptime_formatted ?? "Active"}
            </span>
          </div>
        </div>
      </div>

      {/* ── BOTTOM-RIGHT: [04] RADAR_TELEMETRY ─────────── */}
      <div
        className="hud-corner-box aegis-glass-panel"
        style={{
          position: "absolute",
          bottom: "24px",
          right: "24px",
          width: "260px",
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: isLight ? "1px solid rgba(2, 132, 199, 0.2)" : "1px solid rgba(0, 240, 255, 0.15)",
            paddingBottom: "6px",
          }}
        >
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: "10.5px", fontWeight: 700, color: "var(--text-cyan)", letterSpacing: "1px" }}>
            RADAR_TELEMETRY
          </span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-muted)" }}>
            [04]
          </span>
        </div>

        {/* 360° Rotating Radar Sweep Canvas */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              position: "relative",
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              border: "1px solid var(--cyan-border)",
              background: "rgba(0, 240, 255, 0.03)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {/* Radar Crosshairs */}
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", background: "rgba(0,240,255,0.2)" }} />
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", background: "rgba(0,240,255,0.2)" }} />

            {/* Sweep Beam */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "conic-gradient(from 0deg, rgba(0,240,255,0.4) 0deg, transparent 60deg, transparent 360deg)",
                animation: "radarSweep360 3s linear infinite",
              }}
            />

            {/* Simulated Radar Blip */}
            <div
              style={{
                position: "absolute",
                top: "28%",
                left: "64%",
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                background: "var(--cyan-glow)",
                boxShadow: "0 0 6px var(--cyan-glow)",
              }}
            />
          </div>

          {/* Telemetry Status Labels */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", fontFamily: "'Rajdhani', sans-serif", flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>RADAR_SCAN:</span>
              <span style={{ color: "var(--green-online)", fontWeight: 600 }}>SWEEPING</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>PERIPHERALS:</span>
              <span style={{ color: "var(--text-cyan)", fontFamily: "'DM Mono', monospace" }}>LOCKED</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>HOST_NODE:</span>
              <span style={{ color: "var(--text-main)", fontFamily: "'DM Mono', monospace" }}>
                {telemetry?.hostname ? telemetry.hostname.slice(0, 10) : "LOCAL PC"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

