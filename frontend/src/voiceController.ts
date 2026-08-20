/**
 * Aegis AI — Advanced Voice Interaction Subsystem (Phase 3)
 *
 * Provides:
 *  1. VoiceState Machine (IDLE, LISTENING, RECORDING, TRANSCRIBING, THINKING, SPEAKING, INTERRUPTED, ERROR)
 *  2. Real-time Web Audio VAD (Voice Activity Detection) with auto-silence detection
 *  3. Barge-in / Interruption handling during assistant speech
 *  4. Robust TTS Controller with markdown stripping and completion callbacks
 *  5. Web Audio synthesized acoustic cues
 */

export type VoiceState =
  | "IDLE"
  | "LISTENING"
  | "RECORDING"
  | "TRANSCRIBING"
  | "THINKING"
  | "SPEAKING"
  | "INTERRUPTED"
  | "ERROR";

// ─────────────────────────────────────────────────────────
// Audio Feedback (Web Audio Synthesized Cues)
// ─────────────────────────────────────────────────────────

export function playAudioCue(
  kind: "activated" | "deactivated" | "speech_start" | "speech_stop" | "interrupted" | "error",
  enabled = true
) {
  if (!enabled) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (kind) {
      case "activated": {
        // Ascending chime (520Hz -> 680Hz)
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.14);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }
      case "deactivated": {
        // Descending chime (680Hz -> 480Hz)
        osc.type = "sine";
        osc.frequency.setValueAtTime(680, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.14);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }
      case "speech_start": {
        // Subtle high pip (880Hz)
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case "speech_stop": {
        // Confirmation blip (660Hz)
        osc.type = "sine";
        osc.frequency.setValueAtTime(660, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }
      case "interrupted": {
        // Quick cutoff tick (440Hz -> 330Hz)
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.07);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case "error": {
        // Low alert warble (260Hz)
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(260, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }
    }

    osc.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // Non-critical
  }
}

// ─────────────────────────────────────────────────────────
// Robust TTS Controller
// ─────────────────────────────────────────────────────────

export class TTSController {
  private _speaking = false;
  private _onEndCallback: (() => void) | null = null;
  private _currentUtterance: SpeechSynthesisUtterance | null = null;

  public speak(text: string, onEnd?: () => void) {
    if (!("speechSynthesis" in window)) {
      onEnd?.();
      return;
    }

    this.cancel();

    // Clean text for speech synthesis (strip code blocks, backticks, bold, links, markdown markers)
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "Code block omitted.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#+\s/g, "")
      .replace(/^[-*]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();

    if (!cleanText) {
      this._speaking = false;
      onEnd?.();
      return;
    }

    this._speaking = true;
    this._onEndCallback = onEnd || null;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    this._currentUtterance = utterance;

    utterance.onstart = () => {
      this._speaking = true;
    };

    utterance.onend = () => {
      this._speaking = false;
      this._currentUtterance = null;
      const cb = this._onEndCallback;
      this._onEndCallback = null;
      cb?.();
    };

    utterance.onerror = (e) => {
      this._speaking = false;
      this._currentUtterance = null;
      const cb = this._onEndCallback;
      this._onEndCallback = null;
      // Do not trigger error if it was a user cancel/interruption
      if (e.error !== "canceled" && e.error !== "interrupted") {
        cb?.();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  public cancel() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this._speaking = false;
    this._currentUtterance = null;
    this._onEndCallback = null;
  }

  public isSpeaking(): boolean {
    return this._speaking || ("speechSynthesis" in window && window.speechSynthesis.speaking);
  }
}

// ─────────────────────────────────────────────────────────
// Real-time Web Audio VAD Engine
// ─────────────────────────────────────────────────────────

export interface VADConfig {
  speechThreshold?: number;       // RMS required to start speech (default: 0.035)
  silenceThreshold?: number;      // RMS below which is considered silence (default: 0.022)
  silenceDurationMs?: number;     // Silence duration to auto-stop recording (default: 1300ms)
  minSpeechDurationMs?: number;   // Min speech duration before silence detection applies (default: 450ms)
  bargeInThreshold?: number;      // RMS required to trigger barge-in while assistant speaks (default: 0.055)
  bargeInDurationMs?: number;     // Sustained speech duration for barge-in (default: 140ms)
}

export class VADEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;
  private isRunning = false;

  private speechStartTime: number | null = null;
  private silenceStartTime: number | null = null;
  private bargeInStartTime: number | null = null;
  private speechDetectedInTurn = false;

  public config: Required<VADConfig>;

  // Callbacks
  public onSpeechStart: (() => void) | null = null;
  public onSpeechEnd: (() => void) | null = null;
  public onBargeIn: (() => void) | null = null;
  public onEnergyLevel: ((level: number) => void) | null = null;

  constructor(config?: VADConfig) {
    this.config = {
      speechThreshold: config?.speechThreshold ?? 0.035,
      silenceThreshold: config?.silenceThreshold ?? 0.022,
      silenceDurationMs: config?.silenceDurationMs ?? 1300,
      minSpeechDurationMs: config?.minSpeechDurationMs ?? 450,
      bargeInThreshold: config?.bargeInThreshold ?? 0.055,
      bargeInDurationMs: config?.bargeInDurationMs ?? 140,
    };
  }

  public start(stream: MediaStream, getCurrentState: () => VoiceState) {
    this.stop();

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioCtx = new AudioCtx();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;

      this.source = this.audioCtx.createMediaStreamSource(stream);
      // NOTE: Do not connect analyser to destination to avoid speaker echo/feedback
      this.source.connect(this.analyser);

      this.isRunning = true;
      this.speechStartTime = null;
      this.silenceStartTime = null;
      this.bargeInStartTime = null;
      this.speechDetectedInTurn = false;

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const loop = () => {
        if (!this.isRunning || !this.analyser) return;

        this.analyser.getByteTimeDomainData(dataArray);

        // Compute RMS energy
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sum += norm * norm;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        // Normalized energy indicator [0.0 - 1.0]
        const displayLevel = Math.min(1, rms * 8);
        this.onEnergyLevel?.(displayLevel);

        const now = performance.now();
        const currentState = getCurrentState();

        // ── 1. Barge-in detection while assistant is SPEAKING or THINKING
        if (currentState === "SPEAKING" || currentState === "THINKING") {
          if (rms >= this.config.bargeInThreshold) {
            if (!this.bargeInStartTime) {
              this.bargeInStartTime = now;
            } else if (now - this.bargeInStartTime >= this.config.bargeInDurationMs) {
              // Confirmed user speech during output -> trigger barge-in!
              this.bargeInStartTime = null;
              this.onBargeIn?.();
            }
          } else {
            this.bargeInStartTime = null;
          }
          this.speechStartTime = null;
          this.silenceStartTime = null;
        }

        // ── 2. Speech Start detection when in LISTENING state
        else if (currentState === "LISTENING") {
          if (rms >= this.config.speechThreshold) {
            if (!this.speechStartTime) {
              this.speechStartTime = now;
            } else if (now - this.speechStartTime >= 100) {
              // Sustained speech detected -> start recording
              this.speechDetectedInTurn = true;
              this.speechStartTime = now;
              this.silenceStartTime = null;
              this.onSpeechStart?.();
            }
          } else {
            this.speechStartTime = null;
          }
        }

        // ── 3. Silence / Speech End detection when in RECORDING state
        else if (currentState === "RECORDING") {
          if (rms < this.config.silenceThreshold) {
            if (!this.silenceStartTime) {
              this.silenceStartTime = now;
            } else {
              const elapsedSilence = now - this.silenceStartTime;
              const totalSpeechTime = this.speechStartTime ? now - this.speechStartTime : 1000;

              // If user spoke for at least minSpeechDurationMs and silence has lasted silenceDurationMs
              if (
                this.speechDetectedInTurn &&
                totalSpeechTime >= this.config.minSpeechDurationMs &&
                elapsedSilence >= this.config.silenceDurationMs
              ) {
                this.silenceStartTime = null;
                this.speechStartTime = null;
                this.speechDetectedInTurn = false;
                this.onSpeechEnd?.();
              }
            }
          } else {
            // User is still actively speaking
            this.silenceStartTime = null;
            this.speechDetectedInTurn = true;
          }
        }

        this.animFrameId = requestAnimationFrame(loop);
      };

      this.animFrameId = requestAnimationFrame(loop);
    } catch (err) {
      console.warn("VAD engine initialization failed:", err);
    }
  }

  public resetTurn() {
    this.speechStartTime = null;
    this.silenceStartTime = null;
    this.bargeInStartTime = null;
    this.speechDetectedInTurn = false;
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch { /* ignore */ }
      this.source = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch { /* ignore */ }
      this.analyser = null;
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
