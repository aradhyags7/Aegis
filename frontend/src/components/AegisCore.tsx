import React, { useMemo, useState } from "react";
import { VoiceState } from "../voiceController";

interface AegisCoreProps {
  voiceState: VoiceState;
  audioEnergy: number;
  isVoiceMode: boolean;
  theme?: "dark" | "light";
  onCoreClick?: () => void;
  size?: number;
}

interface ClickRipple {
  id: number;
  timestamp: number;
}

export const AegisCore: React.FC<AegisCoreProps> = ({
  voiceState,
  audioEnergy,
  isVoiceMode,
  theme = "dark",
  onCoreClick,
  size = 350,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState<ClickRipple[]>([]);
  const [isPuffing, setIsPuffing] = useState(false);
  const prevVoiceState = React.useRef(voiceState);

  // Trigger puff effect on command ingestion / state transition
  React.useEffect(() => {
    if (prevVoiceState.current !== voiceState) {
      if (voiceState === "THINKING" || voiceState === "SPEAKING") {
        setIsPuffing(true);
        const t = setTimeout(() => setIsPuffing(false), 340);
        return () => clearTimeout(t);
      }
      prevVoiceState.current = voiceState;
    }
  }, [voiceState]);

  // Trigger click shockwave animation and puff
  const handleClick = () => {
    setIsPuffing(true);
    setTimeout(() => setIsPuffing(false), 340);
    const newRipple = { id: Date.now(), timestamp: Date.now() };
    setRipples(prev => [...prev, newRipple]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 800);
    onCoreClick?.();
  };

  const isLight = theme === "light";

  // Determine state-based visual tokens & speeds
  const stateConfig = useMemo(() => {
    const hoverMultiplier = isHovered ? 0.45 : 1;

    switch (voiceState) {
      case "RECORDING":
        return {
          primaryColor: "#ef4444",
          secondaryColor: "#dc2626",
          glowColor: "rgba(239, 68, 68, 0.75)",
          label: "RECORDING // AUDIO_LOCKED",
          spinSpeedOuter: `${2.8 * hoverMultiplier}s`,
          spinSpeedInner: `${1.8 * hoverMultiplier}s`,
          pulseScale: 1 + audioEnergy * 0.45,
          plasmaGlow: "rgba(239, 68, 68, 0.9)",
          coreSymbol: "🎙",
        };
      case "TRANSCRIBING":
        return {
          primaryColor: isLight ? "#d97706" : "#f59e0b",
          secondaryColor: "#b45309",
          glowColor: "rgba(245, 158, 11, 0.75)",
          label: "TRANSCRIBING // FASTER_WHISPER",
          spinSpeedOuter: `${1.4 * hoverMultiplier}s`,
          spinSpeedInner: `${0.9 * hoverMultiplier}s`,
          pulseScale: 1.1,
          plasmaGlow: "rgba(245, 158, 11, 0.8)",
          coreSymbol: "⚡",
        };
      case "THINKING":
        return {
          primaryColor: isLight ? "#2563eb" : "#3b82f6",
          secondaryColor: "#6366f1",
          glowColor: "rgba(59, 130, 246, 0.8)",
          label: "PROCESSING // NEURAL_OLLAMA",
          spinSpeedOuter: `${1.8 * hoverMultiplier}s`,
          spinSpeedInner: `${1.2 * hoverMultiplier}s`,
          pulseScale: 1.06,
          plasmaGlow: "rgba(59, 130, 246, 0.85)",
          coreSymbol: "◈",
        };
      case "SPEAKING":
        return {
          primaryColor: isLight ? "#0284c7" : "#00f0ff",
          secondaryColor: isLight ? "#0369a1" : "#38bdf8",
          glowColor: isLight ? "rgba(2, 132, 199, 0.8)" : "rgba(0, 240, 255, 0.85)",
          label: "SPEAKING // TTS_TRANSMIT",
          spinSpeedOuter: `${2.2 * hoverMultiplier}s`,
          spinSpeedInner: `${1.5 * hoverMultiplier}s`,
          pulseScale: 1 + (audioEnergy > 0 ? audioEnergy * 0.35 : 0.12),
          plasmaGlow: isLight ? "rgba(2, 132, 199, 0.9)" : "rgba(0, 240, 255, 0.95)",
          coreSymbol: "🔊",
        };
      case "INTERRUPTED":
        return {
          primaryColor: "#f97316",
          secondaryColor: "#ea580c",
          glowColor: "rgba(249, 115, 22, 0.85)",
          label: "BARGE_IN // INTERRUPT_TRIGGERED",
          spinSpeedOuter: `${0.8 * hoverMultiplier}s`,
          spinSpeedInner: `${0.6 * hoverMultiplier}s`,
          pulseScale: 1.2,
          plasmaGlow: "rgba(249, 115, 22, 0.9)",
          coreSymbol: "⚡",
        };
      case "LISTENING":
        return {
          primaryColor: isLight ? "#0284c7" : "#06b6d4",
          secondaryColor: isLight ? "#0369a1" : "#0891b2",
          glowColor: isLight ? "rgba(2, 132, 199, 0.7)" : "rgba(6, 182, 212, 0.7)",
          label: "LISTENING // SENSORS_ARMED",
          spinSpeedOuter: `${6 * hoverMultiplier}s`,
          spinSpeedInner: `${4.5 * hoverMultiplier}s`,
          pulseScale: 1 + audioEnergy * 0.28,
          plasmaGlow: isLight ? "rgba(2, 132, 199, 0.7)" : "rgba(6, 182, 212, 0.7)",
          coreSymbol: "●",
        };
      case "ERROR":
        return {
          primaryColor: "#f87171",
          secondaryColor: "#b91c1c",
          glowColor: "rgba(248, 113, 113, 0.7)",
          label: "SYSTEM_WARN // STANDBY",
          spinSpeedOuter: `${8 * hoverMultiplier}s`,
          spinSpeedInner: `${6 * hoverMultiplier}s`,
          pulseScale: 1.0,
          plasmaGlow: "rgba(248, 113, 113, 0.6)",
          coreSymbol: "⚠",
        };
      case "IDLE":
      default:
        return {
          primaryColor: isVoiceMode
            ? (isLight ? "#0284c7" : "#00f0ff")
            : (isLight ? "#0369a1" : "#0284c7"),
          secondaryColor: isLight ? "#0284c7" : "#0369a1",
          glowColor: isVoiceMode
            ? (isLight ? "rgba(2, 132, 199, 0.6)" : "rgba(0, 240, 255, 0.6)")
            : (isLight ? "rgba(2, 132, 199, 0.35)" : "rgba(2, 132, 199, 0.35)"),
          label: isVoiceMode ? "VOICE_MODE // READY" : "AEGIS_CORE // STANDBY",
          spinSpeedOuter: `${14 * hoverMultiplier}s`,
          spinSpeedInner: `${10 * hoverMultiplier}s`,
          pulseScale: isHovered ? 1.08 : 1.0,
          plasmaGlow: isLight ? "rgba(2, 132, 199, 0.5)" : "rgba(0, 240, 255, 0.5)",
          coreSymbol: "Æ",
        };
    }
  }, [voiceState, audioEnergy, isVoiceMode, isHovered, isLight]);

  // 36 Radial Equalizer Frequency Bars
  const radialBars = useMemo(() => {
    const bars = [];
    const count = 36;
    const baseRadius = size * 0.33;
    for (let i = 0; i < count; i++) {
      const angle = (i * 360) / count;
      const rad = (angle * Math.PI) / 180;
      const wave = Math.sin((i / count) * Math.PI * 4 + Date.now() / 200);
      const isVoiceActive = voiceState === "RECORDING" || voiceState === "SPEAKING";
      const energyMultiplier = isVoiceActive
        ? Math.max(0.2, audioEnergy * (0.9 + wave * 0.4))
        : 0.12 + Math.abs(wave) * 0.08;

      const length = 4 + energyMultiplier * (size * 0.14);

      const x1 = size / 2 + Math.cos(rad) * baseRadius;
      const y1 = size / 2 + Math.sin(rad) * baseRadius;
      const x2 = size / 2 + Math.cos(rad) * (baseRadius + length);
      const y2 = size / 2 + Math.sin(rad) * (baseRadius + length);

      bars.push({ x1, y1, x2, y2, angle, key: i });
    }
    return bars;
  }, [size, audioEnergy, voiceState]);

  // 8 Orbiting Quantum Particles
  const orbitingParticles = useMemo(() => {
    const count = 8;
    const radius = size * 0.44;
    const particles = [];
    for (let i = 0; i < count; i++) {
      const baseAngle = (i * 360) / count;
      particles.push({ id: i, angle: baseAngle, radius });
    }
    return particles;
  }, [size]);

  // 24 Neon Convergent Edge Filaments focusing inward toward centroid
  const edgeFilaments = useMemo(() => {
    const count = 24;
    const outerR = size * 0.285;
    const innerR = size * 0.238;
    const filaments = [];
    for (let i = 0; i < count; i++) {
      const angle = (i * 360) / count;
      const rad = (angle * Math.PI) / 180;
      const x1 = size / 2 + Math.cos(rad) * outerR;
      const y1 = size / 2 + Math.sin(rad) * outerR;
      const x2 = size / 2 + Math.cos(rad) * innerR;
      const y2 = size / 2 + Math.sin(rad) * innerR;
      filaments.push({ id: i, x1, y1, x2, y2 });
    }
    return filaments;
  }, [size]);

  // 64 Precise Ticks for Inner Data Ring (24s period)
  const innerRingTicks = useMemo(() => {
    const ticks = [];
    const count = 64;
    const baseR = size * 0.325 + (isHovered ? 4 : 0);
    for (let i = 0; i < count; i++) {
      const isMajor = i % 8 === 0;
      const tickLen = isMajor ? 6 : 3;
      const angle = (i * 360) / count;
      const rad = (angle * Math.PI) / 180;
      const x1 = size / 2 + Math.cos(rad) * baseR;
      const y1 = size / 2 + Math.sin(rad) * baseR;
      const x2 = size / 2 + Math.cos(rad) * (baseR + tickLen);
      const y2 = size / 2 + Math.sin(rad) * (baseR + tickLen);
      ticks.push({ id: i, x1, y1, x2, y2, isMajor, angle });
    }
    return ticks;
  }, [size, isHovered]);

  // 3 Outer Chevron Framing Brackets (5s period)
  const outerChevrons = useMemo(() => {
    const chevrons = [];
    const count = 3;
    const r = size * 0.455 + (isHovered ? 10 : 0);
    for (let i = 0; i < count; i++) {
      const angle = i * 120;
      chevrons.push({ id: i, angle, r });
    }
    return chevrons;
  }, [size, isHovered]);

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: onCoreClick ? "pointer" : "default",
        userSelect: "none",
        transform: isHovered ? "scale(1.02)" : "scale(1)",
        transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
      title={onCoreClick ? "Click to toggle Voice Interaction" : undefined}
    >
      {/* Background Holographic Atmosphere Glow */}
      <div
        style={{
          position: "absolute",
          width: `${size * 0.85}px`,
          height: `${size * 0.85}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${stateConfig.glowColor} 0%, rgba(0,0,0,0) 70%)`,
          filter: "blur(28px)",
          opacity: isHovered ? 0.95 : 0.75,
          transition: "background 0.3s ease, opacity 0.3s ease",
          pointerEvents: "none",
        }}
      />

      {/* SVG Arc Reactor Canvas */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
        }}
      >
        <defs>
          <linearGradient id="aegisPlasmaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stateConfig.primaryColor} stopOpacity="0.95" />
            <stop offset="60%" stopColor={stateConfig.secondaryColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={isLight ? "#f0f4f9" : "#020813"} stopOpacity="0.95" />
          </linearGradient>

          {/* Crystalline Glass & Refraction Gradient */}
          <radialGradient id="aegisCrystalGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="25%" stopColor={stateConfig.primaryColor} stopOpacity="0.45" />
            <stop offset="70%" stopColor={stateConfig.secondaryColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={isLight ? "#e2e8f0" : "#020813"} stopOpacity="0.95" />
          </radialGradient>

          {/* Specular Glare Highlight */}
          <linearGradient id="aegisGlassSpecular" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>

          <filter id="aegisGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Click Shockwave Ripples */}
        {ripples.map((ripple) => (
          <circle
            key={ripple.id}
            cx={size / 2}
            cy={size / 2}
            fill="none"
            stroke={stateConfig.primaryColor}
            filter="url(#aegisGlow)"
            style={{
              animation: "coreShockwave 0.75s ease-out forwards",
            }}
          />
        ))}

        {/* =========================================================
            THREE HOLOGRAPHIC CONCENTRIC DATA RINGS
            ========================================================= */}

        {/* 1. OUTER RING (Fast 5.0s Clockwise) — Critical Alerts & Chevron Framing */}
        <g
          style={{
            transformOrigin: "center center",
            animation: `spinClockwise ${stateConfig.spinSpeedOuter} linear infinite`,
          }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.455 + (isHovered ? 10 : 0)}
            fill="none"
            stroke={stateConfig.primaryColor}
            strokeWidth="1.6"
            strokeDasharray={`${size * 0.22} ${size * 0.08} ${size * 0.04} ${size * 0.08}`}
            strokeOpacity={isLight ? 0.85 : 0.75}
            filter="url(#aegisGlow)"
          />

          {/* Triple Chevron Framing Brackets with glowing pointer arrows */}
          {outerChevrons.map((c) => {
            const rad = (c.angle * Math.PI) / 180;
            const cx = size / 2 + Math.cos(rad) * c.r;
            const cy = size / 2 + Math.sin(rad) * c.r;
            return (
              <g key={c.id} transform={`rotate(${c.angle} ${cx} ${cy})`}>
                <polygon
                  points={`${cx - 5},${cy - 4} ${cx + 5},${cy} ${cx - 5},${cy + 4}`}
                  fill={stateConfig.primaryColor}
                  filter="url(#aegisGlow)"
                />
              </g>
            );
          })}
        </g>

        {/* 2. MIDDLE RING (Medium 12.0s Counter-Clockwise) — Environmental Telemetry */}
        <g
          style={{
            transformOrigin: "center center",
            animation: `spinCounterClockwise ${stateConfig.spinSpeedInner} linear infinite`,
          }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.39 + (isHovered ? 6 : 0)}
            fill="none"
            stroke={stateConfig.secondaryColor}
            strokeWidth="1.4"
            strokeDasharray="8 16 32 8"
            strokeOpacity={isLight ? 0.75 : 0.65}
          />

          {/* 4 Orbital Sensor Crosshairs */}
          {[45, 135, 225, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const rMid = size * 0.39 + (isHovered ? 6 : 0);
            const x1 = size / 2 + Math.cos(rad) * (rMid - 4);
            const y1 = size / 2 + Math.sin(rad) * (rMid - 4);
            const x2 = size / 2 + Math.cos(rad) * (rMid + 4);
            const y2 = size / 2 + Math.sin(rad) * (rMid + 4);
            return (
              <line
                key={deg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stateConfig.primaryColor}
                strokeWidth="1.8"
                strokeOpacity="0.85"
              />
            );
          })}
        </g>

        {/* 3. INNER RING (Slow 24.0s Clockwise) — 64 Ticks & Kernel Diagnostics */}
        <g
          style={{
            transformOrigin: "center center",
            animation: `spinClockwise ${stateConfig.spinSpeedOuter === "2.8s" ? "4s" : "24s"} linear infinite`,
          }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.325 + (isHovered ? 4 : 0)}
            fill="none"
            stroke={stateConfig.primaryColor}
            strokeWidth="0.8"
            strokeOpacity={isLight ? 0.4 : 0.3}
          />

          {/* 64 System Diagnostic Ticks */}
          {innerRingTicks.map((t) => (
            <line
              key={t.id}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={stateConfig.primaryColor}
              strokeWidth={t.isMajor ? "1.6" : "0.9"}
              strokeOpacity={t.isMajor ? 0.85 : 0.45}
            />
          ))}

          {/* 4 Quadrant Degree Telemetry Notches */}
          {[0, 90, 180, 270].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const rDeg = size * 0.35 + (isHovered ? 4 : 0);
            const x = size / 2 + Math.cos(rad) * rDeg;
            const y = size / 2 + Math.sin(rad) * rDeg;
            return (
              <text
                key={deg}
                x={x}
                y={y + 3}
                textAnchor="middle"
                fill={stateConfig.primaryColor}
                fontSize="6.5"
                fontFamily="'DM Mono', monospace"
                opacity="0.75"
              >
                {deg.toString().padStart(2, "0")}°
              </text>
            );
          })}
        </g>

        {/* 3. 36-Bar Sound-Reactive Equalizer Ring */}
        <g>
          {radialBars.map((bar) => (
            <line
              key={bar.key}
              x1={bar.x1}
              y1={bar.y1}
              x2={bar.x2}
              y2={bar.y2}
              stroke={stateConfig.primaryColor}
              strokeWidth="1.6"
              strokeOpacity="0.9"
              strokeLinecap="round"
              filter="url(#aegisGlow)"
              style={{ transition: "all 0.04s ease" }}
            />
          ))}
        </g>

        {/* 4. Orbiting Quantum Nodes */}
        <g
          style={{
            transformOrigin: "center center",
            animation: `spinClockwise ${stateConfig.spinSpeedOuter} linear infinite`,
          }}
        >
          {orbitingParticles.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            const x = size / 2 + Math.cos(rad) * p.radius;
            const y = size / 2 + Math.sin(rad) * p.radius;
            return (
              <circle
                key={p.id}
                cx={x}
                cy={y}
                r={2 + (audioEnergy > 0 ? audioEnergy * 2.5 : 0)}
                fill={stateConfig.primaryColor}
                filter="url(#aegisGlow)"
                style={{ transition: "r 0.05s ease" }}
              />
            );
          })}
        </g>

        {/* 5. 24 Neon Convergent Edge Filaments */}
        <g>
          {edgeFilaments.map((f) => (
            <line
              key={f.id}
              x1={f.x1}
              y1={f.y1}
              x2={f.x2}
              y2={f.y2}
              stroke={stateConfig.primaryColor}
              strokeWidth="1.2"
              strokeOpacity="0.75"
              strokeDasharray="4 2"
              style={{
                animation: "filamentConverge 2s ease-in-out infinite",
                animationDelay: `${(f.id % 4) * 0.25}s`,
              }}
            />
          ))}
        </g>

        {/* Puff Expansion Shockwave Rings */}
        {isPuffing && (
          <>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.24}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              style={{ animation: "radialShockwave 0.35s ease-out forwards" }}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.24}
              fill="none"
              stroke={stateConfig.primaryColor}
              strokeWidth="1.8"
              style={{ animation: "radialShockwave 0.45s ease-out 0.08s forwards" }}
            />
          </>
        )}

        {/* 6. Central Crystalline Glass Orb (The Brain of AEGIS) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.235 * stateConfig.pulseScale * (isPuffing ? 1.16 : 1)}
          fill="url(#aegisCrystalGrad)"
          stroke={stateConfig.primaryColor}
          strokeWidth="2.4"
          filter="url(#aegisGlow)"
          style={{
            transformOrigin: "center center",
            transition: "r 0.1s cubic-bezier(0.16, 1, 0.3, 1), fill 0.3s ease, stroke 0.3s ease",
          }}
        />

        {/* Specular Crystal Glass Highlight */}
        <ellipse
          cx={size / 2 - size * 0.05}
          cy={size / 2 - size * 0.06}
          rx={size * 0.11}
          ry={size * 0.065}
          fill="url(#aegisGlassSpecular)"
          opacity="0.65"
          style={{ pointerEvents: "none" }}
        />

        {/* Inner Hexagonal Cell */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.135}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeOpacity="0.8"
          strokeDasharray="6 3"
        />

        {/* Center Aegis Monogram */}
        <text
          x={size / 2}
          y={size / 2 + 5}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={size * 0.12}
          fontFamily="'Orbitron', monospace"
          fontWeight="900"
          letterSpacing="1px"
          style={{
            pointerEvents: "none",
            textShadow: `0 0 14px ${stateConfig.plasmaGlow}`,
          }}
        >
          Æ
        </text>
      </svg>

      {/* Under-Core Holographic State Banner */}
      <div
        style={{
          position: "absolute",
          bottom: "-34px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: "10.5px",
            fontWeight: 700,
            letterSpacing: "1.5px",
            color: stateConfig.primaryColor,
            textShadow: `0 0 8px ${stateConfig.glowColor}`,
            textTransform: "uppercase",
            transition: "color 0.3s ease",
          }}
        >
          {stateConfig.label}
        </span>
        <span
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: isLight ? "#64748b" : "rgba(226, 232, 240, 0.6)",
          }}
        >
          [ AEGIS PROTOCOL // CLICK CORE TO INTERACT ]
        </span>
      </div>
    </div>
  );
};
