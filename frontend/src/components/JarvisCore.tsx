import React, { useMemo, useState } from "react";
import { VoiceState } from "../voiceController";

interface JarvisCoreProps {
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

export const JarvisCore: React.FC<JarvisCoreProps> = ({
  voiceState,
  audioEnergy,
  isVoiceMode,
  theme = "dark",
  onCoreClick,
  size = 350,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState<ClickRipple[]>([]);

  // Trigger click shockwave animation
  const handleClick = () => {
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
          label: "TRANSCRIBING // WHISPER_INT8",
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
          width: `${size * 0.8}px`,
          height: `${size * 0.8}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${stateConfig.glowColor} 0%, rgba(0,0,0,0) 70%)`,
          filter: "blur(28px)",
          opacity: isHovered ? 0.95 : 0.75,
          transition: "background 0.3s ease, opacity 0.3s ease",
          pointerEvents: "none",
        }}
      />

      {/* Concentric Speaking/Listening Soundwave Ripples */}
      {(voiceState === "SPEAKING" || voiceState === "RECORDING") && (
        <>
          <div
            style={{
              position: "absolute",
              width: `${size * 0.7}px`,
              height: `${size * 0.7}px`,
              borderRadius: "50%",
              border: `2px solid ${stateConfig.primaryColor}`,
              animation: "soundwaveRipples 2s cubic-bezier(0, 0.2, 0.8, 1) infinite",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: `${size * 0.7}px`,
              height: `${size * 0.7}px`,
              borderRadius: "50%",
              border: `1.5px solid ${stateConfig.primaryColor}`,
              animation: "soundwaveRipples 2s cubic-bezier(0, 0.2, 0.8, 1) infinite",
              animationDelay: "0.6s",
              pointerEvents: "none",
            }}
          />
        </>
      )}

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
          <linearGradient id="jarvisPlasmaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stateConfig.primaryColor} stopOpacity="0.95" />
            <stop offset="60%" stopColor={stateConfig.secondaryColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={isLight ? "#f0f4f9" : "#020813"} stopOpacity="0.95" />
          </linearGradient>

          <filter id="jarvisGlow" x="-50%" y="-50%" width="200%" height="200%">
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
            filter="url(#jarvisGlow)"
            style={{
              animation: "coreShockwave 0.75s ease-out forwards",
            }}
          />
        ))}

        {/* Outermost Compass Perimeter Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.47}
          fill="none"
          stroke={stateConfig.primaryColor}
          strokeWidth="1"
          strokeOpacity={isLight ? 0.35 : 0.25}
          strokeDasharray="4 8"
        />

        {/* 1. Outer Rotating Segmented Telemetry Ring */}
        <g
          style={{
            transformOrigin: "center center",
            animation: `spinClockwise ${stateConfig.spinSpeedOuter} linear infinite`,
          }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.44}
            fill="none"
            stroke={stateConfig.primaryColor}
            strokeWidth="1.8"
            strokeDasharray={`${size * 0.28} ${size * 0.08} ${size * 0.04} ${size * 0.08}`}
            strokeOpacity={isLight ? 0.85 : 0.75}
            filter="url(#jarvisGlow)"
          />

          {/* 4 Compass Telemetry Nodes */}
          {[0, 90, 180, 270].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x = size / 2 + Math.cos(rad) * (size * 0.44);
            const y = size / 2 + Math.sin(rad) * (size * 0.44);
            return (
              <circle
                key={deg}
                cx={x}
                cy={y}
                r="3"
                fill={stateConfig.primaryColor}
                filter="url(#jarvisGlow)"
              />
            );
          })}
        </g>

        {/* 2. Middle Counter-Rotating Gear Ring */}
        <g
          style={{
            transformOrigin: "center center",
            animation: `spinCounterClockwise ${stateConfig.spinSpeedInner} linear infinite`,
          }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.38}
            fill="none"
            stroke={stateConfig.secondaryColor}
            strokeWidth="1.2"
            strokeDasharray="8 6 22 6"
            strokeOpacity={isLight ? 0.7 : 0.6}
          />
          {/* Tactical Crosshair Marks */}
          {[45, 135, 225, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = size / 2 + Math.cos(rad) * (size * 0.36);
            const y1 = size / 2 + Math.sin(rad) * (size * 0.36);
            const x2 = size / 2 + Math.cos(rad) * (size * 0.40);
            const y2 = size / 2 + Math.sin(rad) * (size * 0.40);
            return (
              <line
                key={deg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stateConfig.primaryColor}
                strokeWidth="2"
                strokeOpacity="0.9"
              />
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
              filter="url(#jarvisGlow)"
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
                filter="url(#jarvisGlow)"
                style={{ transition: "r 0.05s ease" }}
              />
            );
          })}
        </g>

        {/* 5. Inner Arc Core Reactor Plasma Orb */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.22 * stateConfig.pulseScale}
          fill="url(#jarvisPlasmaGrad)"
          stroke={stateConfig.primaryColor}
          strokeWidth="2.2"
          filter="url(#jarvisGlow)"
          style={{
            transformOrigin: "center center",
            transition: "r 0.08s ease, fill 0.3s ease, stroke 0.3s ease",
          }}
        />

        {/* Inner Arc Reactor Hexagonal Lattice Cell */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.13}
          fill="none"
          stroke={isLight ? "#ffffff" : "#ffffff"}
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
