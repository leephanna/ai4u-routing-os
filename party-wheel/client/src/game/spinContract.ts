import type { SegmentType } from "../../../shared/gameTypes";

export type SpinCommittedEvent = {
  event: "spin_committed";
  roomCode: string;
  roomId: number;
  activePlayerId: number;
  activePlayerName: string;
  holdMs: number;
  chargePercent: number;
  spinStartedAt: number;
  spinDurationMs: number;
  finalAngle: number;
  segmentIndex: number;
  segmentType: SegmentType;
  segmentLabel: string;
  gameEventId: number;
};

/**
 * Validates and parses a raw broadcast payload into a SpinCommittedEvent.
 * Returns null if the payload is missing required fields or has invalid types.
 */
export function parseSpinEvent(data: Record<string, unknown>): SpinCommittedEvent | null {
  if (typeof data.roomId !== "number") return null;
  if (typeof data.activePlayerId !== "number") return null;
  if (typeof data.spinStartedAt !== "number") return null;
  if (typeof data.spinDurationMs !== "number") return null;
  if (typeof data.finalAngle !== "number") return null;
  if (typeof data.segmentIndex !== "number") return null;
  if (typeof data.segmentType !== "string") return null;
  if (typeof data.segmentLabel !== "string") return null;
  if (typeof data.gameEventId !== "number") return null;

  return {
    event: "spin_committed",
    roomCode: typeof data.roomCode === "string" ? data.roomCode : "",
    roomId: data.roomId,
    activePlayerId: data.activePlayerId,
    activePlayerName: typeof data.activePlayerName === "string" ? data.activePlayerName : "Player",
    holdMs: typeof data.holdMs === "number" ? data.holdMs : 0,
    chargePercent: typeof data.chargePercent === "number" ? data.chargePercent : 1.0,
    spinStartedAt: data.spinStartedAt,
    spinDurationMs: data.spinDurationMs,
    finalAngle: data.finalAngle,
    segmentIndex: data.segmentIndex,
    segmentType: data.segmentType as SegmentType,
    segmentLabel: data.segmentLabel,
    gameEventId: data.gameEventId,
  };
}

/**
 * Returns how many milliseconds have elapsed since the spin started.
 * Useful for late-joining clients to seek the animation to the correct position.
 */
export function getAnimationElapsedMs(spinStartedAt: number): number {
  return Date.now() - spinStartedAt;
}

/**
 * Ease-out cubic function: starts fast, decelerates to final value.
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Computes the current wheel angle for a late-joining client based on elapsed time.
 *
 * Uses ease-out easing so the animation appears to decelerate naturally.
 * If elapsed time exceeds spinDurationMs, the finalAngle is returned directly.
 *
 * @param spinStartedAt  - Unix timestamp (ms) when the spin began
 * @param spinDurationMs - Total duration of the spin animation in ms
 * @param finalAngle     - The pre-determined final resting angle in radians
 * @param currentTime    - Override for current time (defaults to Date.now()), useful for testing
 * @returns Current wheel angle in radians
 */
export function getElapsedWheelAngle(
  spinStartedAt: number,
  spinDurationMs: number,
  finalAngle: number,
  currentTime: number = Date.now(),
): number {
  const elapsed = currentTime - spinStartedAt;

  if (elapsed <= 0) return 0;
  if (elapsed >= spinDurationMs) return finalAngle;

  // Normalized progress [0, 1]
  const t = elapsed / spinDurationMs;

  // Apply ease-out: the wheel starts with a large angular offset (multiple full rotations)
  // and decelerates to finalAngle. We model total rotation as finalAngle + N full rotations.
  // For animation purposes, we add 4 full rotations to the final angle so the wheel spins
  // visibly before stopping.
  const totalRotation = finalAngle + 4 * 2 * Math.PI;
  const easedProgress = easeOutCubic(t);

  return (totalRotation * easedProgress) % (2 * Math.PI);
}
