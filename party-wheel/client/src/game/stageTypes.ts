import type { SegmentType } from "../../../shared/gameTypes";

export type StagePhase =
  | "lobby"
  | "waiting"
  | "spin_charge"
  | "spinning"
  | "pointer_closeup"
  | "category_reveal"
  | "challenge"
  | "answer_submission"
  | "voting"
  | "scoring"
  | "next_turn"
  | "game_over";

export interface StageState {
  phase: StagePhase;
  roomCode: string;
  roomId: number | null;
  activePlayerId: number | null;
  activePlayerName: string;
  spinStartedAt: number | null;
  spinDurationMs: number | null;
  finalAngle: number | null;
  segmentIndex: number | null;
  segmentType: SegmentType | null;
  segmentLabel: string | null;
  currentEventId: number | null;
  content: string | null;
  isCharging: boolean;
  chargePercent: number;
}

export const INITIAL_STAGE_STATE: StageState = {
  phase: "lobby",
  roomCode: "",
  roomId: null,
  activePlayerId: null,
  activePlayerName: "",
  spinStartedAt: null,
  spinDurationMs: null,
  finalAngle: null,
  segmentIndex: null,
  segmentType: null,
  segmentLabel: null,
  currentEventId: null,
  content: null,
  isCharging: false,
  chargePercent: 0,
};

/** Map server GamePhase to StagePhase */
export function serverPhaseToStagePhase(serverPhase: string): StagePhase {
  const map: Record<string, StagePhase> = {
    lobby: "lobby",
    waiting: "waiting",
    spinning: "spinning",
    landing_closeup: "pointer_closeup",
    result: "category_reveal",
    challenge: "challenge",
    answer_submission: "answer_submission",
    voting: "voting",
    scoring: "scoring",
    game_over: "game_over",
  };
  return map[serverPhase] ?? "waiting";
}
