import React, { useEffect, useRef, useState, useCallback } from "react";
import { VoiceState } from "../voiceController";

interface AegisCoreProps {
  voiceState: VoiceState;
  audioEnergy: number;
  isVoiceMode: boolean;
  theme?: "dark" | "light";
  onCoreClick?: () => void;
  size?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Shockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  width: number;
  color: string;
  speed: number;
}

export const AegisCore: React.FC<AegisCoreProps> = ({
  voiceState,
  audioEnergy,
  isVoiceMode,
  theme = "dark",
  onCoreClick,
  size = 460,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Animation & Particle state refs
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const mouseSmoothRef = useRef({ x: 0, y: 0 });
  const prevVoiceStateRef = useRef<VoiceState>(voiceState);
  const puffEnergyRef = useRef<number>(0);

  const isLight = theme === "light";

  // Trigger explosive particle puff burst
  const triggerPuffExplosion = useCallback((intensity = 1.0) => {
    puffEnergyRef.current = 1.0;
    const count = Math.floor(65 * intensity);
    const primaryColor =
      voiceState === "RECORDING"
        ? "#ef4444"
        : voiceState === "THINKING" || voiceState === "TRANSCRIBING"
        ? "#8b5cf6"
        : "#00f0ff";

    const secondaryColor =
      voiceState === "RECORDING"
        ? "#f87171"
        : voiceState === "THINKING"
        ? "#f59e0b"
        : "#ffffff";

    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2.2 + Math.random() * 5.8) * intensity;
      const life = 24 + Math.random() * 32;
      newParticles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.2 + Math.random() * 2.8,
        alpha: 0.95,
        color: Math.random() > 0.4 ? primaryColor : secondaryColor,
        life: life,
        maxLife: life,
      });
    }
    particlesRef.current.push(...newParticles);

    // Expanding shockwaves
    shockwavesRef.current.push(
      {
        radius: size * 0.16,
        maxRadius: size * 0.48,
        alpha: 0.85,
        width: 3.2,
        color: "#ffffff",
        speed: 4.8 * intensity,
      },
      {
        radius: size * 0.12,
        maxRadius: size * 0.44,
        alpha: 0.7,
        width: 2.2,
        color: primaryColor,
        speed: 3.6 * intensity,
      }
    );
  }, [voiceState, size]);

  // Trigger puff on command ingestion / voice state transitions
  useEffect(() => {
    if (prevVoiceStateRef.current !== voiceState) {
      if (
        voiceState === "THINKING" ||
        voiceState === "SPEAKING" ||
        voiceState === "RECORDING"
      ) {
        triggerPuffExplosion(1.15);
      }
      prevVoiceStateRef.current = voiceState;
    }
  }, [voiceState, triggerPuffExplosion]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setMousePos({ x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) });
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    setMousePos({ x: 0, y: 0 });
  };

  const handleClick = () => {
    triggerPuffExplosion(1.35);
    onCoreClick?.();
  };

  // ─────────────────────────────────────────────────────────
  // Master Canvas 60 FPS Render Loop
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      timeRef.current += 0.016;
      const t = timeRef.current;

      // Decay puff energy
      puffEnergyRef.current *= 0.92;

      // Smooth mouse parallax
      mouseSmoothRef.current.x += (mousePos.x - mouseSmoothRef.current.x) * 0.08;
      mouseSmoothRef.current.y += (mousePos.y - mouseSmoothRef.current.y) * 0.08;
      const mx = mouseSmoothRef.current.x;
      const my = mouseSmoothRef.current.y;

      const dpr = window.devicePixelRatio || 1;
      const w = size;
      const h = size;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      // State-driven color definitions
      let primaryColor = "#00f0ff";
      let secondaryColor = "#8b5cf6";
      let glowColor = "rgba(0, 240, 255, 0.45)";
      let speedMult = 1.0;

      if (voiceState === "RECORDING") {
        primaryColor = "#ef4444";
        secondaryColor = "#f87171";
        glowColor = "rgba(239, 68, 68, 0.55)";
        speedMult = 1.4;
      } else if (voiceState === "TRANSCRIBING") {
        primaryColor = "#f59e0b";
        secondaryColor = "#fbbf24";
        glowColor = "rgba(245, 158, 11, 0.55)";
        speedMult = 1.8;
      } else if (voiceState === "THINKING") {
        primaryColor = "#8b5cf6";
        secondaryColor = "#3b82f6";
        glowColor = "rgba(139, 92, 246, 0.6)";
        speedMult = 2.4;
      } else if (voiceState === "SPEAKING") {
        primaryColor = "#00f0ff";
        secondaryColor = "#38bdf8";
        glowColor = "rgba(0, 240, 255, 0.65)";
        speedMult = 1.6;
      } else if (voiceState === "ERROR") {
        primaryColor = "#ef4444";
        secondaryColor = "#991b1b";
        glowColor = "rgba(239, 68, 68, 0.7)";
        speedMult = 2.0;
      }

      // ── 1. Volumetric Deep Ambient Glow ──
      const breath = Math.sin(t * 2.094) * 0.05 + 1.0; // 1.5s idle breath cycle
      const audioBoost = (audioEnergy || 0) * 0.35;
      const puffScale = 1.0 + puffEnergyRef.current * 0.16;
      const dynamicScale = breath * (1 + audioBoost) * puffScale;

      const outerGlowRadius = size * 0.44 * dynamicScale;
      const bgGlow = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, outerGlowRadius);
      bgGlow.addColorStop(0, glowColor);
      bgGlow.addColorStop(0.45, "rgba(0, 240, 255, 0.08)");
      bgGlow.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = bgGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, outerGlowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── 2. Cinematic Iron Man Arc Reactor Mechanical Rings ──
      const reactorRotation = t * 0.35 * speedMult;

      // Outer Mechanical Segment Ring (12 Segments)
      const rOuter = size * 0.40;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(reactorRotation);

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = primaryColor;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 10;

      const segmentCount = 12;
      const segAngle = (Math.PI * 2) / segmentCount;
      for (let i = 0; i < segmentCount; i++) {
        const startA = i * segAngle + 0.05;
        const endA = (i + 1) * segAngle - 0.08;

        ctx.beginPath();
        ctx.arc(0, 0, rOuter, startA, endA);
        ctx.stroke();

        // Mechanical Arc End Notch
        const nx = Math.cos(startA) * (rOuter - 6);
        const ny = Math.sin(startA) * (rOuter - 6);
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.arc(nx, ny, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outer Chevron Framing Brackets (3 brackets at 120 deg)
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const bx = Math.cos(angle) * (rOuter + 8);
        const by = Math.sin(angle) * (rOuter + 8);

        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(angle + 0.08) * 8, by + Math.sin(angle + 0.08) * 8);
        ctx.lineTo(bx + Math.cos(angle - 0.08) * 8, by + Math.sin(angle - 0.08) * 8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Middle Counter-Rotating Sensor Ring (24 Diagnostic Ticks)
      const rMid = size * 0.33;
      const midRotation = -t * 0.52 * speedMult;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midRotation);

      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
      ctx.shadowBlur = 0;

      const tickCount = 36;
      for (let i = 0; i < tickCount; i++) {
        const angle = (i * Math.PI * 2) / tickCount;
        const isMajor = i % 9 === 0;
        const tLen = isMajor ? 8 : 4;
        const x1 = Math.cos(angle) * (rMid - tLen);
        const y1 = Math.sin(angle) * (rMid - tLen);
        const x2 = Math.cos(angle) * rMid;
        const y2 = Math.sin(angle) * rMid;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isMajor ? primaryColor : "rgba(0, 240, 255, 0.35)";
        ctx.stroke();
      }

      // 3 High-Energy Orbital Telemetry Nodes
      for (let i = 0; i < 3; i++) {
        const nodeAngle = (i * Math.PI * 2) / 3 + t * 0.8;
        const nx = Math.cos(nodeAngle) * rMid;
        const ny = Math.sin(nodeAngle) * rMid;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(nx, ny, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Inner High-Speed Conduit Ring
      const rInner = size * 0.27;
      const innerRotation = t * 0.85 * speedMult;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(innerRotation);

      ctx.beginPath();
      ctx.arc(0, 0, rInner, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // Degree Quadrant Markers
      ctx.font = "9px 'DM Mono', monospace";
      ctx.fillStyle = primaryColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const markers = ["000°", "090°", "180°", "270°"];
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const tx = Math.cos(a) * (rInner - 12);
        const ty = Math.sin(a) * (rInner - 12);
        ctx.fillText(markers[i], tx, ty);
      }
      ctx.restore();

      // ── 3. True 3D Volumetric Crystalline Glass Orb (The Brain) ──
      const orbRadius = size * 0.21 * dynamicScale;

      // A. Back Refraction Volume (Dark glass substrate with metallic core depth)
      const orbGrad = ctx.createRadialGradient(
        cx + mx * 10,
        cy + my * 10,
        orbRadius * 0.15,
        cx,
        cy,
        orbRadius
      );
      orbGrad.addColorStop(0, "rgba(10, 30, 60, 0.95)");
      orbGrad.addColorStop(0.65, "rgba(5, 14, 30, 0.9)");
      orbGrad.addColorStop(1, "rgba(0, 8, 20, 0.98)");

      ctx.save();
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
      ctx.fill();

      // Glass Rim Fresnel Lighting
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = primaryColor;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();

      // B. Internal 3D Crystal Lattice Facets
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius - 1.5, 0, Math.PI * 2);
      ctx.clip(); // Constrain crystal facets and filaments inside the sphere

      // Subtle crystal polygon lines catching dynamic refraction light
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = "rgba(0, 240, 255, 0.18)";
      const facetCount = 8;
      for (let i = 0; i < facetCount; i++) {
        const a1 = (i * Math.PI * 2) / facetCount + t * 0.12;
        const a2 = ((i + 3) * Math.PI * 2) / facetCount + t * 0.12;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a1) * (orbRadius * 0.85), cy + Math.sin(a1) * (orbRadius * 0.85));
        ctx.lineTo(cx + Math.cos(a2) * (orbRadius * 0.45), cy + Math.sin(a2) * (orbRadius * 0.45));
        ctx.stroke();
      }

      // C. Living Internal Plasma Filaments (Drifting toward Center)
      const filamentCount = 28;
      const energyExcitement = Math.max(0.1, audioEnergy * 3.2);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < filamentCount; i++) {
        const baseAngle = (i * Math.PI * 2) / filamentCount;
        const drift = t * (0.35 + (i % 3) * 0.15) * speedMult;
        const angle = baseAngle + drift;

        // Outer anchor on the glass rim
        const xStart = cx + Math.cos(angle) * (orbRadius * 0.92);
        const yStart = cy + Math.sin(angle) * (orbRadius * 0.92);

        // Sinusoidal undulating control point with sound reactivity
        const wave = Math.sin(t * 3.5 + i * 1.2) * (14 + energyExcitement * 24);
        const midR = orbRadius * (0.45 + (i % 4) * 0.08);
        const xCtrl = cx + Math.cos(angle + 0.35) * midR + Math.cos(drift * 2) * wave;
        const yCtrl = cy + Math.sin(angle + 0.35) * midR + Math.sin(drift * 2) * wave;

        // Center singularity destination
        const endR = orbRadius * 0.06;
        const xEnd = cx + Math.cos(angle * 2) * endR;
        const yEnd = cy + Math.sin(angle * 2) * endR;

        // Draw living glowing filament curve
        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.quadraticCurveTo(xCtrl, yCtrl, xEnd, yEnd);

        ctx.strokeStyle = i % 2 === 0 ? primaryColor : secondaryColor;
        ctx.lineWidth = 1.0 + (energyExcitement * 1.5);
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Tip energy bead
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(xCtrl, yCtrl, 1.2 + energyExcitement * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // D. Central Energy Singularity (Luminous Core Nucleus)
      const nucleusRadius = orbRadius * 0.22 * (1 + (audioEnergy || 0) * 0.6);
      const nucleusGrad = ctx.createRadialGradient(
        cx,
        cy,
        nucleusRadius * 0.1,
        cx,
        cy,
        nucleusRadius
      );
      nucleusGrad.addColorStop(0, "#ffffff");
      nucleusGrad.addColorStop(0.35, primaryColor);
      nucleusGrad.addColorStop(0.8, secondaryColor);
      nucleusGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = nucleusGrad;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(cx, cy, nucleusRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core Geometric Symbol (High-Tech Monogram)
      ctx.font = `900 ${Math.round(size * 0.07)}px 'Orbitron', monospace`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 12;
      ctx.fillText("Æ", cx, cy + 2);
      ctx.restore();

      // E. Front Specular Glare & 3D Glass Highlight (Follows Parallax Cursor)
      const specX = cx - orbRadius * 0.35 + mx * 18;
      const specY = cy - orbRadius * 0.35 + my * 18;
      const specRadius = orbRadius * 0.45;

      const specGrad = ctx.createRadialGradient(
        specX,
        specY,
        specRadius * 0.05,
        specX,
        specY,
        specRadius
      );
      specGrad.addColorStop(0, "rgba(255, 255, 255, 0.75)");
      specGrad.addColorStop(0.4, "rgba(0, 240, 255, 0.25)");
      specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.save();
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.ellipse(specX, specY, specRadius, specRadius * 0.6, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore(); // End orb clipping

      // ── 4. Expanding Shockwaves & Radiant Particle Physics ──
      // Update and draw shockwaves
      for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i];
        sw.radius += sw.speed;
        sw.alpha *= 0.94;

        if (sw.radius >= sw.maxRadius || sw.alpha <= 0.02) {
          shockwavesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = sw.width * (sw.alpha / 0.85);
        ctx.globalAlpha = sw.alpha;
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(cx, cy, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Update and draw spark particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= 1;
        p.alpha = Math.max(0, p.life / p.maxLife);

        if (p.life <= 0 || p.alpha <= 0.01) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx + p.x, cy + p.y, p.radius * p.alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [size, voiceState, audioEnergy, mousePos, triggerPuffExplosion]);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: "block",
          filter: isHovered ? "drop-shadow(0 0 32px var(--cyan-glow))" : "none",
          transition: "filter 0.3s ease",
        }}
      />

      {/* Under-Core Holographic State Status Banner */}
      <div
        style={{
          position: "absolute",
          bottom: "-32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3px",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor:
                voiceState === "RECORDING"
                  ? "#ef4444"
                  : voiceState === "THINKING"
                  ? "#8b5cf6"
                  : "#00f0ff",
              boxShadow: `0 0 8px ${
                voiceState === "RECORDING"
                  ? "#ef4444"
                  : voiceState === "THINKING"
                  ? "#8b5cf6"
                  : "#00f0ff"
              }`,
            }}
          />
          <span
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: "10.5px",
              fontWeight: 700,
              letterSpacing: "1.5px",
              color:
                voiceState === "RECORDING"
                  ? "#ef4444"
                  : voiceState === "THINKING"
                  ? "#8b5cf6"
                  : isLight
                  ? "#0284c7"
                  : "#00f0ff",
              textShadow: "0 0 10px rgba(0, 240, 255, 0.4)",
              textTransform: "uppercase",
            }}
          >
            {voiceState === "RECORDING"
              ? "RECORDING // AUDIO_LOCKED"
              : voiceState === "TRANSCRIBING"
              ? "TRANSCRIBING // FASTER_WHISPER"
              : voiceState === "THINKING"
              ? "PROCESSING // NEURAL_OLLAMA"
              : voiceState === "SPEAKING"
              ? "TRANSMITTING // SYNTHESIS"
              : isVoiceMode
              ? "ONLINE // VOICE_STANDBY"
              : "AEGIS PROTOCOL // READY"}
          </span>
        </div>

        <span
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: isLight ? "#64748b" : "rgba(226, 232, 240, 0.55)",
          }}
        >
          [ CLICK CORE TO TRIGGER ENERGY PULSE // SPACE / ESC ]
        </span>
      </div>
    </div>
  );
};
