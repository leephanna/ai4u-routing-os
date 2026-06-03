// Web Audio API sound effects for AI4U Party Wheel

import type { SegmentType } from "../../../shared/gameTypes";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gainValue = 0.3,
  startDelay = 0,
) {
  try {
    const ctx = getCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startDelay);

    gainNode.gain.setValueAtTime(0, ctx.currentTime + startDelay);
    gainNode.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + startDelay + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);

    oscillator.start(ctx.currentTime + startDelay);
    oscillator.stop(ctx.currentTime + startDelay + duration + 0.05);
  } catch {
    // Silently fail if audio is not available
  }
}

export function playSpinSound() {
  try {
    const ctx = getCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch { /* */ }
}

export function playTickSound() {
  playTone(1200, 0.03, "square", 0.08);
}

export function playLandSound(segmentType: string) {
  const positive = ["firewall_bonus", "braincell_check", "prompt_duel", "truth_cache", "glitch_dare", "deepfake_drama", "crowd_override"];
  const isPositive = positive.includes(segmentType);

  if (isPositive) {
    playTone(523, 0.15, "sine", 0.3, 0);
    playTone(659, 0.15, "sine", 0.3, 0.1);
    playTone(784, 0.25, "sine", 0.3, 0.2);
  } else {
    playTone(150, 0.1, "sawtooth", 0.4, 0);
    playTone(80, 0.15, "sawtooth", 0.4, 0.08);
    playTone(40, 0.2, "square", 0.3, 0.15);
  }
}

export function playVoteSound() {
  playTone(880, 0.1, "sine", 0.2);
}

export function playRobotAttackSound() {
  for (let i = 0; i < 5; i++) {
    playTone(200 - i * 30, 0.1, "sawtooth", 0.35, i * 0.08);
  }
  playTone(50, 0.4, "square", 0.5, 0.45);
}

export function playCelebrationSound() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((note, i) => {
    playTone(note, 0.2, "sine", 0.25, i * 0.12);
  });
}

/** 3-2-1 countdown ticks before a spin. tick=3 is highest pitch, tick=1 is lowest */
export function playSpinPreviewCountdown(tick: 1 | 2 | 3) {
  const freqs: Record<1 | 2 | 3, number> = { 3: 880, 2: 660, 1: 440 };
  playTone(freqs[tick], 0.12, "sine", 0.35);
}

/** Unique audio signature per segment type */
export function playSegmentReveal(segmentType: SegmentType) {
  switch (segmentType) {
    case "firewall_bonus":
      // Ascending major chord — victory fanfare
      playTone(523, 0.15, "sine", 0.3, 0);
      playTone(659, 0.15, "sine", 0.3, 0.1);
      playTone(784, 0.2, "sine", 0.3, 0.2);
      playTone(1047, 0.3, "sine", 0.35, 0.3);
      break;
    case "robot_slapdown":
      // Mechanical error descending tones
      playTone(400, 0.08, "sawtooth", 0.4, 0);
      playTone(300, 0.08, "sawtooth", 0.4, 0.1);
      playTone(200, 0.08, "sawtooth", 0.4, 0.2);
      playTone(100, 0.2, "square", 0.5, 0.3);
      break;
    case "system_crash":
      // Glitchy static burst
      for (let i = 0; i < 8; i++) {
        playTone(Math.random() * 800 + 100, 0.05, "sawtooth", 0.3, i * 0.04);
      }
      break;
    case "braincell_check":
      // Quiz show ding ding ding
      playTone(1047, 0.08, "sine", 0.3, 0);
      playTone(1047, 0.08, "sine", 0.3, 0.12);
      playTone(1047, 0.08, "sine", 0.3, 0.24);
      playTone(1319, 0.2, "sine", 0.35, 0.36);
      break;
    case "prompt_duel":
      // Dramatic battle begins two-tone
      playTone(330, 0.2, "sawtooth", 0.35, 0);
      playTone(440, 0.3, "sawtooth", 0.35, 0.2);
      break;
    default:
      // Neutral reveal chime
      playTone(660, 0.12, "sine", 0.25, 0);
      playTone(880, 0.2, "sine", 0.25, 0.12);
      break;
  }
}

/** Short +/- sound when score updates */
export function playScoreChange(positive: boolean) {
  if (positive) {
    playTone(880, 0.08, "sine", 0.2, 0);
    playTone(1100, 0.12, "sine", 0.2, 0.08);
  } else {
    playTone(300, 0.08, "sawtooth", 0.25, 0);
    playTone(200, 0.12, "sawtooth", 0.25, 0.08);
  }
}

/** Vote countdown — plays accelerating tones at 10, 5, 4, 3, 2, 1 seconds */
export function playVoteCountdown(secondsLeft: number) {
  const triggers = [10, 5, 4, 3, 2, 1];
  if (!triggers.includes(secondsLeft)) return;
  // Pitch increases as time runs out
  const pitchMap: Record<number, number> = { 10: 440, 5: 550, 4: 620, 3: 700, 2: 800, 1: 1000 };
  const freq = pitchMap[secondsLeft] ?? 440;
  playTone(freq, 0.1, "sine", 0.3);
}

export function resumeAudio() {
  if (audioCtx?.state === "suspended") {
    audioCtx.resume();
  }
}
