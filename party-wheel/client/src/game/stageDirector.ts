import { useCallback, useEffect, useReducer } from "react";
import type { SegmentType } from "../../../shared/gameTypes";
import { INITIAL_STAGE_STATE, serverPhaseToStagePhase } from "./stageTypes";
import type { StagePhase, StageState } from "./stageTypes";
import { parseSpinEvent } from "./spinContract";

// ── Reducer ────────────────────────────────────────────────────────────────

type StageAction =
  | { type: "SET_PHASE"; phase: StagePhase }
  | { type: "SET_ROOM"; roomCode: string; roomId: number | null }
  | { type: "APPLY_SPIN_EVENT"; payload: {
      activePlayerId: number;
      activePlayerName: string;
      spinStartedAt: number;
      spinDurationMs: number;
      finalAngle: number;
      segmentIndex: number;
      segmentType: SegmentType;
      segmentLabel: string;
      currentEventId: number;
      chargePercent: number;
    }
  }
  | { type: "APPLY_SPIN_RESULT"; payload: {
      segmentType: SegmentType;
      segmentLabel: string;
      finalAngle: number;
      currentEventId: number | null;
      content: string | null;
    }
  };

function stageReducer(state: StageState, action: StageAction): StageState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase };

    case "SET_ROOM":
      return { ...state, roomCode: action.roomCode, roomId: action.roomId };

    case "APPLY_SPIN_EVENT":
      return {
        ...state,
        phase: "spinning",
        activePlayerId: action.payload.activePlayerId,
        activePlayerName: action.payload.activePlayerName,
        spinStartedAt: action.payload.spinStartedAt,
        spinDurationMs: action.payload.spinDurationMs,
        finalAngle: action.payload.finalAngle,
        segmentIndex: action.payload.segmentIndex,
        segmentType: action.payload.segmentType,
        segmentLabel: action.payload.segmentLabel,
        currentEventId: action.payload.currentEventId,
        chargePercent: action.payload.chargePercent,
        isCharging: false,
      };

    case "APPLY_SPIN_RESULT":
      return {
        ...state,
        segmentType: action.payload.segmentType,
        segmentLabel: action.payload.segmentLabel,
        finalAngle: action.payload.finalAngle,
        currentEventId: action.payload.currentEventId,
        content: action.payload.content,
      };

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export interface UseStageDirectorOptions {
  roomCode: string;
  serverPhase: string;
  currentPlayerId: number | null;
  myPlayerId: number | null;
  lastSpinResultJson: unknown;
  currentEventId: number | null;
}

export interface UseStageDirectorResult {
  stage: StageState;
  transition: (phase: StagePhase) => void;
}

/**
 * useStageDirector
 *
 * Single source of truth for what every client sees.
 * Maps server-authoritative phase/spin data to a rich StageState that
 * drives all UI components.
 *
 * - serverPhase changes → stage.phase updates via serverPhaseToStagePhase
 * - lastSpinResultJson changes → spin fields (segment, angles, etc.) update
 * - transition() allows local phase overrides (e.g. optimistic UI)
 */
export function useStageDirector({
  roomCode,
  serverPhase,
  currentPlayerId,
  myPlayerId: _myPlayerId,
  lastSpinResultJson,
  currentEventId,
}: UseStageDirectorOptions): UseStageDirectorResult {
  const [stage, dispatch] = useReducer(stageReducer, {
    ...INITIAL_STAGE_STATE,
    roomCode,
  });

  // Sync roomCode into state when it changes
  useEffect(() => {
    dispatch({ type: "SET_ROOM", roomCode, roomId: stage.roomId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Sync server phase → stage phase
  useEffect(() => {
    const mappedPhase = serverPhaseToStagePhase(serverPhase);
    dispatch({ type: "SET_PHASE", phase: mappedPhase });
  }, [serverPhase]);

  // Sync lastSpinResultJson → spin fields
  useEffect(() => {
    if (!lastSpinResultJson || typeof lastSpinResultJson !== "object") return;

    const raw = lastSpinResultJson as Record<string, unknown>;

    // Try to parse as a full SpinCommittedEvent first
    const spinEvent = parseSpinEvent(raw);
    if (spinEvent) {
      dispatch({
        type: "APPLY_SPIN_EVENT",
        payload: {
          activePlayerId: spinEvent.activePlayerId,
          activePlayerName: spinEvent.activePlayerName,
          spinStartedAt: spinEvent.spinStartedAt,
          spinDurationMs: spinEvent.spinDurationMs,
          finalAngle: spinEvent.finalAngle,
          segmentIndex: spinEvent.segmentIndex,
          segmentType: spinEvent.segmentType,
          segmentLabel: spinEvent.segmentLabel,
          currentEventId: spinEvent.gameEventId,
          chargePercent: spinEvent.chargePercent,
        },
      });
      return;
    }

    // Fallback: partial spin result (legacy SpinResult shape)
    if (
      typeof raw.segmentType === "string" &&
      typeof raw.segmentLabel === "string" &&
      typeof raw.finalAngle === "number"
    ) {
      dispatch({
        type: "APPLY_SPIN_RESULT",
        payload: {
          segmentType: raw.segmentType as SegmentType,
          segmentLabel: raw.segmentLabel,
          finalAngle: raw.finalAngle,
          currentEventId: typeof raw.gameEventId === "number" ? raw.gameEventId : currentEventId,
          content: typeof raw.content === "string" ? raw.content : null,
        },
      });
    }
  }, [lastSpinResultJson, currentEventId]);

  // Sync currentPlayerId into stage when it changes
  useEffect(() => {
    if (currentPlayerId !== null && currentPlayerId !== stage.activePlayerId) {
      // Only update activePlayerId when not in the middle of a spin
      // (the spin event itself carries the authoritative activePlayerId)
      if (stage.phase === "waiting" || stage.phase === "lobby" || stage.phase === "next_turn") {
        dispatch({
          type: "APPLY_SPIN_RESULT",
          payload: {
            segmentType: stage.segmentType ?? ("braincell_check" as SegmentType),
            segmentLabel: stage.segmentLabel ?? "",
            finalAngle: stage.finalAngle ?? 0,
            currentEventId: currentEventId,
            content: stage.content,
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayerId]);

  const transition = useCallback((phase: StagePhase) => {
    dispatch({ type: "SET_PHASE", phase });
  }, []);

  return { stage, transition };
}
