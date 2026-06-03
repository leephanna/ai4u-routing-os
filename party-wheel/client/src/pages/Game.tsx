import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import WheelCanvas from "@/components/WheelCanvas";
import WheelSVG from "@/components/WheelSVG";
import GameStageShell from "@/components/stage/GameStageShell";
import SpinButton from "@/components/SpinButton";
import AvatarCard from "@/components/AvatarCard";
import VotingPanel from "@/components/VotingPanel";
import TruthResponsePanel from "@/components/TruthResponsePanel";
import DareResponsePanel from "@/components/DareResponsePanel";
import DuelResponsePanel from "@/components/DuelResponsePanel";
import RobotAttack from "@/components/RobotAttack";
import TriviaPanel from "@/components/TriviaPanel";
import { toast } from "sonner";
import {
  playSpinSound, playLandSound, playRobotAttackSound, playCelebrationSound,
  playSpinPreviewCountdown, playSegmentReveal, playScoreChange, playVoteCountdown,
  resumeAudio,
} from "@/lib/audio";
import type { SegmentType, SpinResult, AvatarState, ChatMessagePayload } from "../../../shared/gameTypes";
import { SEGMENT_LABELS, SEGMENT_EMOJIS, SEGMENT_COLORS } from "../../../shared/gameTypes";
import type { RoomBroadcastPayload } from "@/hooks/useRoomRealtime";
import { Trophy, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import CopyrightFooter from "@/components/CopyrightFooter";
import GiphyReaction from "@/components/GiphyReaction";
import { GameChat } from "@/components/GameChat";
import { useBotEngine } from "@/hooks/useBotEngine";

type Phase = "waiting" | "spin_preview" | "spinning" | "landing" | "result" | "voting" | "robot_attack" | "answer_submission";

// ── Cinematic landing animation styles ────────────────────────────────────────
const LANDING_KEYFRAMES = `
@keyframes segmentZoomIn {
  0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
  60%  { transform: scale(1.25) rotate(3deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes colorFlash {
  0%   { opacity: 0.8; transform: scale(1); }
  50%  { opacity: 0.4; transform: scale(1.5); }
  100% { opacity: 0; transform: scale(2); }
}
@keyframes particleDrift {
  0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.8; }
  100% { transform: translateY(-120px) translateX(var(--dx)) scale(0); opacity: 0; }
}
@keyframes countdownPop {
  0%   { transform: scale(0.5); opacity: 0; }
  50%  { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes slideUpFade {
  from { transform: translateY(24px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
`;

let landingKFInjected = false;
function injectLandingKeyframes() {
  if (landingKFInjected) return;
  landingKFInjected = true;
  const s = document.createElement("style");
  s.textContent = LANDING_KEYFRAMES;
  document.head.appendChild(s);
}

// ── Helper: derive AvatarState ─────────────────────────────────────────────────
function getAvatarState(
  playerId: number,
  currentPlayerId: number | null | undefined,
  phase: Phase,
  spinResult: SpinResult | null,
): AvatarState {
  const isActive = playerId === currentPlayerId;
  const isNeg = spinResult?.segmentType === "robot_slapdown" || spinResult?.segmentType === "system_crash";

  if ((phase === "spinning" || phase === "spin_preview") && isActive) return "spinning";
  if (phase === "result" && isActive && isNeg) return "defeated";
  if (phase === "result" && isActive && !isNeg) return "celebrate";
  if (phase === "result" && !isActive && isNeg) return "shocked";
  if (phase === "voting") return "voting";
  if (!isActive && phase === "waiting") return "watching";
  return "idle";
}

export default function Game() {
  injectLandingKeyframes();

  const params = useParams<{ code: string }>();
  const roomCode = (params.code ?? "").toUpperCase();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [wheelAngle, setWheelAngle] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [showRobot, setShowRobot] = useState(false);
  const [currentEventId, setCurrentEventId] = useState<number | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  const [myVote, setMyVote] = useState<string | undefined>(undefined);
  const [voteTimeLeft, setVoteTimeLeft] = useState<number>(30);
  const [countdown, setCountdown] = useState<number | null>(null); // 3-2-1 for spin_preview
  const [landingSegment, setLandingSegment] = useState<{ type: SegmentType; color: string } | null>(null);
  const [showHostControls, setShowHostControls] = useState(false);
  // Giphy GIF reaction — shown for holo_drama and after_dark on result reveal
  const [showGiphy, setShowGiphy] = useState(false);
  // FIX 5: Countdown timer for bot auto-advance
  const [botAdvanceCountdown, setBotAdvanceCountdown] = useState<number | null>(null);
  const giphySegmentRef = useRef<string>("");
  const spinAnimRef = useRef<number>(0);
  const spinAngleRef = useRef<number>(0);
  // Phase D: store server-provided finalAngle for deterministic animation
  const serverFinalAngleRef = useRef<number | null>(null);
  const voteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Bug 3: live chat messages appended from Realtime events
  const [liveMessages, setLiveMessages] = useState<ChatMessagePayload[]>([]);
  // Bug 3: stable refs to avoid stale closures in handleRoomUpdate
  const isMyTurnRef = useRef(false);
  const animateSpinRef = useRef<((velocity: number, targetAngle?: number) => void) | null>(null);

  const utils = trpc.useUtils();

  // Bug 3: full Realtime event dispatcher — acts on payload instead of just invalidating
  const handleRoomUpdate = useCallback((payload: RoomBroadcastPayload) => {
    // Always refetch to keep tRPC cache fresh
    void utils.room.get.invalidate({ code: roomCode });

    const { event, data } = payload;

    switch (event) {
      case "spin_committed": {
        // Instantly start wheel animation on passive clients without waiting for poll
        if (!isMyTurnRef.current) {
          setPhase("spinning");
          setIsSpinning(true);
          const vel = typeof data.velocity === "number" ? data.velocity : 10;
          const fa = typeof data.finalAngle === "number" ? data.finalAngle : undefined;
          animateSpinRef.current?.(vel, fa);
        }
        break;
      }
      case "room_update": {
        // Phase transitions for passive players
        if (!isMyTurnRef.current) {
          const sp = data.currentPhase as string | undefined;
          if (sp === "result" && data.lastSpinResultJson) {
            const sr = data.lastSpinResultJson as SpinResult;
            setSpinResult(sr);
            setLandingSegment({
              type: sr.segmentType as SegmentType,
              color: SEGMENT_COLORS[sr.segmentType as SegmentType] ?? "#7c3aed",
            });
            setPhase("landing");
            playSegmentReveal(sr.segmentType as SegmentType);
            setTimeout(() => setPhase("result"), 2500);
          } else if (sp === "voting" && data.lastSpinResultJson) {
            const sr = data.lastSpinResultJson as SpinResult;
            setSpinResult(sr);
            setCurrentEventId(typeof data.currentEventId === "number" ? data.currentEventId : null);
            setPhase("voting");
          } else if (sp === "waiting") {
            setPhase("waiting");
            setSpinResult(null);
            setIsSpinning(false);
          }
        }
        break;
      }
      case "game_ended": {
        // Immediately navigate to end screen on ALL clients
        navigate(`/room/${roomCode}/end`);
        break;
      }
      case "chat_message": {
        // Append to live chat state
        if (data && data.message) {
          setLiveMessages((prev) => [...prev.slice(-99), data as ChatMessagePayload]);
        }
        break;
      }
      default:
        break;
    }
  }, [utils, roomCode, navigate]);

  useRoomRealtime({
    roomCode,
    onUpdate: handleRoomUpdate,
    enabled: !!roomCode,
  });

  // Fallback poll every 3s in case Realtime is unavailable
  const roomByCodeQuery = trpc.room.get.useQuery(
    { code: roomCode },
    { refetchInterval: 3000 }
  );

  const room = roomByCodeQuery.data;
  const players = room?.players ?? [];
  // Bug 1: use server-computed myPlayerId so guests can identify themselves
  const guestSessionId = localStorage.getItem("ai4u_guest_session_id");
  const myPlayer = room?.myPlayerId
    ? players.find((p) => p.id === room.myPlayerId)
    : players.find((p) =>
        (user?.id && p.userId === user.id) ||
        (guestSessionId && p.guestSessionId === guestSessionId)
      );
  const currentPlayer = players.find((p) => p.id === room?.currentPlayerId);
  const isMyTurn = myPlayer?.id === room?.currentPlayerId;
  const isHost = myPlayer?.isHost === true || room?.hostId === user?.id;
  const botPlayers = players.filter((p) => p.isBot);

  // Bot engine — drives bot turns automatically (only active on host)
  useBotEngine({
    room: room ?? null,
    botPlayers: botPlayers.map((p) => ({
      id: p.id,
      name: p.guestName ?? "Bot",
      botPersonality: p.botPersonality ?? "CHAOS_GREMLIN",
      avatarIndex: p.avatarIndex,
    })),
    myPlayerId,
    isHost,
  });

  // Server spin result (for Ron — non-active players read from room)
  const serverSpinResult = room?.lastSpinResultJson as SpinResult | null | undefined;

  // Set myPlayerId from room data
  useEffect(() => {
    if (myPlayer && !myPlayerId) {
      setMyPlayerId(myPlayer.id);
    }
  }, [myPlayer, myPlayerId]);

  // Bug 3: keep isMyTurnRef fresh to avoid stale closures in handleRoomUpdate
  useEffect(() => { isMyTurnRef.current = isMyTurn; }, [isMyTurn]);

  // Redirect if game ended
  useEffect(() => {
    if (room?.status === "ended") {
      navigate(`/room/${roomCode}/end`);
    }
  }, [room?.status, roomCode, navigate]);

  // Sync phase from server for non-active players (the Ron fix)
  useEffect(() => {
    if (!room || isMyTurn) return;
    const sp = room.currentPhase;

    // Bug 2: handle "spinning" phase — server writes "spinning" immediately after spin
    if ((sp === "spinning" || sp === "spin_preview") && phase !== "spinning" && phase !== "spin_preview") {
      setPhase("spinning");
      setIsSpinning(true);
      if (room.lastSpinVelocity !== null && room.lastSpinVelocity !== undefined) {
        if (room.finalAngle !== null && room.finalAngle !== undefined) {
          animateSpin(room.lastSpinVelocity, room.finalAngle);
        } else {
          animateSpin(room.lastSpinVelocity);
        }
      }
    } else if (sp === "landing_closeup" && phase !== "landing" && phase !== "spinning") {
      // FIX 2: Show landing animation — server will auto-advance to result/voting in ~5s
      if (serverSpinResult) {
        setSpinResult(serverSpinResult);
        setLandingSegment({
          type: serverSpinResult.segmentType as SegmentType,
          color: SEGMENT_COLORS[serverSpinResult.segmentType as SegmentType] ?? "#7c3aed",
        });
        setIsSpinning(false);
        playSegmentReveal(serverSpinResult.segmentType as SegmentType);
        if (serverSpinResult.segmentType !== "firewall_bonus") {
          giphySegmentRef.current = serverSpinResult.segmentType;
          setShowGiphy(true);
        }
        setPhase("landing");
      }
    } else if (sp === "answer_submission" && phase !== "answer_submission") {
      // Active player submitted, waiting for others (truth_cache / prompt_duel)
      setPhase("answer_submission");
      setCurrentEventId(room.currentEventId ?? null);
      if (serverSpinResult) setSpinResult(serverSpinResult);
    } else if (sp === "voting" && phase !== "voting") {
      setPhase("voting");
      setCurrentEventId(room.currentEventId ?? null);
      if (serverSpinResult) setSpinResult(serverSpinResult);
    } else if (sp === "result" && phase !== "result" && phase !== "landing") {
      // Trigger landing animation then show result
      if (serverSpinResult) {
        setSpinResult(serverSpinResult);
        setLandingSegment({ type: serverSpinResult.segmentType as SegmentType, color: SEGMENT_COLORS[serverSpinResult.segmentType as SegmentType] ?? "#7c3aed" });
        setPhase("landing");
        playSegmentReveal(serverSpinResult.segmentType as SegmentType);
        // Part 3: Giphy reaction on all segments except firewall_bonus (positive/calm)
        if (serverSpinResult.segmentType !== "firewall_bonus") {
          giphySegmentRef.current = serverSpinResult.segmentType;
          setShowGiphy(true);
        }
        setTimeout(() => setPhase("result"), 5000);
      } else {
        setPhase("result");
      }
    } else if (sp === "waiting" && phase !== "waiting") {
      setPhase("waiting");
      setSpinResult(null);
      setIsSpinning(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.currentPhase, room?.currentEventId, serverSpinResult, isMyTurn]);

  // Reset myVote when phase returns to waiting
  useEffect(() => {
    if (room?.currentPhase === "waiting") {
      setMyVote(undefined);
    }
  }, [room?.currentPhase]);

  // Vote countdown timer
  useEffect(() => {
    if (phase === "voting") {
      setVoteTimeLeft(90);
      voteTimerRef.current = setInterval(() => {
        setVoteTimeLeft((prev) => {
          playVoteCountdown(prev);
          if (prev <= 1) {
            clearInterval(voteTimerRef.current!);
            if (room && currentEventId) {
              resolveExpiredMutation.mutate({ roomId: room.id, gameEventId: currentEventId });
            } else {
              setPhase("result");
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (voteTimerRef.current) clearInterval(voteTimerRef.current);
    }
    return () => {
      if (voteTimerRef.current) clearInterval(voteTimerRef.current);
    };
  }, [phase]);

  // FIX 5: Bot advance countdown timer (60 seconds)
  useEffect(() => {
    if (phase !== "result" || isMyTurn) return;
    const hasBots = players.some(p => p.isBot && p.id === room?.currentPlayerId);
    if (!hasBots) return;
    
    // Count down from 60
    setBotAdvanceCountdown(60);
    const timer = setInterval(() => {
      setBotAdvanceCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { clearInterval(timer); setBotAdvanceCountdown(null); };
  }, [phase, isMyTurn, room?.currentPlayerId, players]);

  // Poll vote results while in voting phase
  const voteResultsQuery = trpc.voting.getResults.useQuery(
    { gameEventId: currentEventId ?? 0 },
    {
      enabled: phase === "voting" && currentEventId !== null,
      refetchInterval: 2000,
    }
  );

  // Query challenge responses for truth_cache and prompt_duel segments
  const challengeResponsesQuery = trpc.challenge.getResponses.useQuery(
    { gameEventId: currentEventId ?? 0 },
    {
      enabled: (phase === "voting" || phase === "result" || phase === "answer_submission" || phase === "landing") && currentEventId !== null,
      refetchInterval: 2000,
    }
  );

  // Derive submitted answers from challenge_responses
  const truthAnswer = challengeResponsesQuery.data?.find(
    (r) => r.responseType === "truth_answer"
  )?.textResponse ?? undefined;
  const duelAnswerA = challengeResponsesQuery.data?.find(
    (r) => r.responseType === "duel_answer" && r.playerId === room?.currentPlayerId
  )?.textResponse ?? undefined;
  const duelAnswerB = challengeResponsesQuery.data?.find(
    (r) => r.responseType === "duel_answer" && r.playerId !== room?.currentPlayerId
  )?.textResponse ?? undefined;
  const dareChoice = challengeResponsesQuery.data?.find(
    (r) => r.responseType === "dare_accept" || r.responseType === "dare_skip"
  )?.responseType ?? undefined;

  const spinMutation = trpc.game.spin.useMutation({
    onSuccess: (data) => {
      // Ensure spinStartedAt is a number (Unix timestamp in ms)
      const spinData = {
        ...data,
        spinStartedAt: typeof data.spinStartedAt === 'string' ? new Date(data.spinStartedAt).getTime() : data.spinStartedAt,
      } as SpinResult;
      setSpinResult(spinData);
      playLandSound(data.segmentType);
      const segType = data.segmentType as SegmentType;
      setLandingSegment({ type: segType, color: SEGMENT_COLORS[segType] ?? "#7c3aed" });
      setPhase("landing");
      playSegmentReveal(segType);
      // Part 3: Giphy reaction on all segments except firewall_bonus
      if (data.segmentType !== "firewall_bonus") {
        giphySegmentRef.current = data.segmentType;
        setShowGiphy(true);
      }

      setTimeout(() => {
        if (data.segmentType === "robot_slapdown" || data.segmentType === "system_crash") {
          setPhase("robot_attack");
          setShowRobot(true);
          playRobotAttackSound();
          setTimeout(() => {
            setShowRobot(false);
            setPhase("result");
          }, 5000);
        } else if (data.segmentType === "truth_cache" || data.segmentType === "glitch_dare") {
          // These go to answer_submission first, then voting after response submitted
          setPhase("answer_submission");
          setCurrentEventId(data.gameEventId ?? null);
        } else if (data.segmentType === "prompt_duel" || data.segmentType === "crowd_override") {
          setPhase("voting");
          setCurrentEventId(data.gameEventId ?? null);
        } else {
          if (data.pointsDelta > 0) {
            playCelebrationSound();
            playScoreChange(true);
          } else if (data.pointsDelta < 0) {
            playScoreChange(false);
          }
          setPhase("result");
        }
      }, 5000);

      roomByCodeQuery.refetch();
    },
    onError: (e) => {
      toast.error(e.message);
      setIsSpinning(false);
      setPhase("waiting");
    },
  });

  const voteCastMutation = trpc.voting.cast.useMutation({
    onSuccess: () => {
      roomByCodeQuery.refetch();
      voteResultsQuery.refetch();
    },
    onError: (e) => toast.error(`Vote failed: ${e.message}`),
  });

  const resolveExpiredMutation = trpc.voting.resolveExpired.useMutation({
    onSuccess: () => {
      roomByCodeQuery.refetch();
    },
    onError: () => setPhase("result"),
  });

  const nextTurnMutation = trpc.game.nextTurn.useMutation({
    onSuccess: () => {
      setPhase("waiting");
      setSpinResult(null);
      setIsSpinning(false);
      setMyVote(undefined);
      setLandingSegment(null);
      roomByCodeQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const endGameMutation = trpc.game.end.useMutation({
    onSuccess: (data) => {
      navigate(`/room/${roomCode}/end?replay=${data.shareToken}`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Phase F: host safety controls
  const kickPlayerMutation = trpc.game.kickPlayer.useMutation({
    onSuccess: () => { toast.success("Player kicked"); roomByCodeQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const resetPhaseMutation = trpc.game.resetPhase.useMutation({
    onSuccess: () => { toast.success("Phase reset to waiting"); setPhase("waiting"); setSpinResult(null); roomByCodeQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const rematchMutation = trpc.game.rematch.useMutation({
    onSuccess: (data) => { toast.success("Rematch started!"); navigate(`/room/${data.code}`); },
    onError: (e) => toast.error(e.message),
  });

  // Phase D: Wheel spin animation — uses server finalAngle when available for deterministic result
  const animateSpin = useCallback((velocity: number, targetAngle?: number) => {
    const startAngle = spinAngleRef.current;
    const startTime = performance.now();
    const duration = 3000 + velocity * 80;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      let currentAngle: number;
      if (targetAngle !== undefined) {
        // Deterministic: animate toward the exact server-provided final angle
        const totalRotation = Math.ceil(velocity * 3) * 2 * Math.PI + targetAngle - (startAngle % (2 * Math.PI));
        currentAngle = startAngle + totalRotation * eased;
      } else {
        const totalRotation = velocity * 2 * Math.PI * 3;
        currentAngle = startAngle + totalRotation * eased;
      }

      setWheelAngle(currentAngle);
      spinAngleRef.current = currentAngle;

      if (progress < 1) {
        spinAnimRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
      }
    };

    spinAnimRef.current = requestAnimationFrame(animate);
  }, []);

  // Bug 3: keep animateSpinRef fresh after animateSpin is defined
  useEffect(() => { animateSpinRef.current = animateSpin; }, [animateSpin]);

  // Phase D: Spin preview: 3-2-1 countdown then spin with server-authoritative finalAngle
  const handleSpin = useCallback((velocity: number) => {
    if (!room || !myPlayerId || isSpinning) return;
    resumeAudio();
    setPhase("spin_preview");
    setCountdown(3);

    let tick = 3;
    playSpinPreviewCountdown(3);

    countdownTimerRef.current = setInterval(() => {
      tick -= 1;
      if (tick > 0) {
        setCountdown(tick);
        playSpinPreviewCountdown(tick as 1 | 2 | 3);
      } else {
        clearInterval(countdownTimerRef.current!);
        setCountdown(null);
        setIsSpinning(true);
        setPhase("spinning");
        playSpinSound();
        // Start animation with client velocity; will snap to server finalAngle on success
        animateSpin(velocity);
        spinMutation.mutate(
          { roomId: room.id, playerId: myPlayerId, velocity },
          {
            onSuccess: (data) => {
              // Phase D: snap wheel to server-authoritative final angle
              if (data.finalAngle !== undefined) {
                serverFinalAngleRef.current = data.finalAngle;
                cancelAnimationFrame(spinAnimRef.current);
                animateSpin(data.velocity ?? velocity, data.finalAngle);
              }
            },
          }
        );
      }
    }, 600);
  }, [room, myPlayerId, isSpinning, animateSpin, spinMutation]);

  const handleNextTurn = (forceByHost = false) => {
    if (!room) return;
    nextTurnMutation.mutate({
      roomId: room.id,
      playerId: myPlayerId ?? undefined,
      forceByHost,
    });
  };

  const handleEndGame = () => {
    if (!room) return;
    endGameMutation.mutate({ roomId: room.id });
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(spinAnimRef.current);
      if (voteTimerRef.current) clearInterval(voteTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // FIX 2: Sync currentEventId from server polling
  useEffect(() => {
    if (!room) return;
    if (room.currentEventId && room.currentEventId !== currentEventId) {
      setCurrentEventId(room.currentEventId);
    }
    if (room.currentPhase === "waiting" && currentEventId !== null) {
      setCurrentEventId(null);
    }
  }, [room?.currentEventId, room?.currentPhase]);

  if (roomByCodeQuery.isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-violet-400 font-orbitron animate-pulse">LOADING GAME...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-red-400 font-orbitron">GAME NOT FOUND</div>
      </div>
    );
  }

  const segmentType = spinResult?.segmentType as SegmentType | undefined;
  const isNegative = segmentType === "robot_slapdown" || segmentType === "system_crash";
  const segmentEmoji = segmentType ? (SEGMENT_EMOJIS[segmentType] ?? "✨") : "✨";
  const segmentColor = segmentType ? (SEGMENT_COLORS[segmentType] ?? "#7c3aed") : "#7c3aed";

  // Helper: map vote choice ID to display label
  const getChoiceLabel = (choiceId: string, segmentType?: string): string => {
    const labelMap: Record<string, Record<string, string>> = {
      truth_cache: { yes: "Yes", no: "No" },
      glitch_dare: { pass: "Pass", fail: "Fail" },
      prompt_duel: { player_a: "Player A", player_b: "Player B" },
      crowd_override: { option_a: "Option A", option_b: "Option B" },
      braincell_check: { correct: "Correct", wrong: "Wrong" },
      holo_drama: { yes: "Yes", no: "No" },
    };
    if (segmentType && labelMap[segmentType]) {
      return labelMap[segmentType][choiceId] ?? choiceId;
    }
    return choiceId;
  };

  // Parse crowd_override option texts from the LLM content string
  // Expected format: "...Option A: <text>. Option B: <text>..."
  const parseCrowdOptions = (content: string): { a: string; b: string } => {
    const aMatch = content.match(/Option A[:\s]+([^.!?]+[.!?]?)/i);
    const bMatch = content.match(/Option B[:\s]+([^.!?]+[.!?]?)/i);
    return {
      a: aMatch?.[1]?.trim() ?? "Option A",
      b: bMatch?.[1]?.trim() ?? "Option B",
    };
  };

  const duelOpponent = players.find((p) => p.id !== room.currentPlayerId);
  const crowdOpts = spinResult?.segmentType === "crowd_override" && spinResult.content
    ? parseCrowdOptions(spinResult.content)
    : { a: "Option A", b: "Option B" };

  const votingOptions =
    spinResult?.segmentType === "prompt_duel"
      ? [
          { id: "player_a", label: duelAnswerA ? `"${duelAnswerA}"` : `${currentPlayer?.guestName ?? "Player 1"}'s answer` },
          { id: "player_b", label: duelAnswerB ? `"${duelAnswerB}"` : `${duelOpponent?.guestName ?? "Player 2"}'s answer` },
        ]
      : spinResult?.segmentType === "truth_cache"
      ? [
          { id: "yes", label: "✅ Yes, they answered honestly" },
          { id: "no", label: "❌ No, that was a lie" },
        ]
      : spinResult?.segmentType === "glitch_dare"
      ? [
          { id: "pass", label: "🏆 PASS — they did it!" },
          { id: "fail", label: "💀 FAIL — they chickened out" },
        ]
      : [
          { id: "option_a", label: crowdOpts.a },
          { id: "option_b", label: crowdOpts.b },
        ];

  const showWheel = phase === "waiting" || phase === "spin_preview" || phase === "spinning";
  const showContent = phase === "result" || phase === "voting" || phase === "landing" || phase === "robot_attack" || phase === "answer_submission";

  return (
    <GameStageShell phase={phase} roomCode={roomCode} roundNumber={room.roundNumber} timeLeft={phase === "voting" ? voteTimeLeft : null}>
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col"
      style={{ touchAction: "pan-x" }}
    >
      {/* Section 2b: TV Studio Background — deep indigo stage with spotlight radials */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(109,40,217,0.35) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 20% 100%, rgba(6,182,212,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139,92,246,0.12) 0%, transparent 60%), linear-gradient(180deg, #0a0010 0%, #050008 60%, #000005 100%)",
      }} />
      {/* Subtle scanline texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
      }} />
      {/* Stage floor reflection line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent pointer-events-none" />

      {/* Robot attack overlay */}
      {showRobot && <RobotAttack active={showRobot} targetName={currentPlayer?.guestName ?? ""} onComplete={() => setShowRobot(false)} />}

      {/* ── Spin Preview Overlay ─────────────────────────────────────────── */}
      {phase === "spin_preview" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          {/* Particle field */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-violet-400"
                style={{
                  left: `${Math.random() * 100}%`,
                  bottom: `${Math.random() * 40}%`,
                  "--dx": `${(Math.random() - 0.5) * 80}px`,
                  animation: `particleDrift ${1.5 + Math.random()}s ease-out ${Math.random() * 0.5}s infinite`,
                } as React.CSSProperties}
              />
            ))}
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6">
            {/* Active player avatar large */}
            <div
              className="text-6xl"
              style={{ animation: "avatarBounce 0.6s ease-in-out infinite" }}
            >
              {["🤖","👾","🦾","🧠","⚡","🔮","🎭","🔥","❄️","🌀","💀","🎲"][(currentPlayer?.avatarIndex ?? 0) % 12]}
            </div>

            {/* Player name */}
            <div className="font-orbitron font-black text-2xl text-white" style={{ animation: "countdownPop 0.4s ease-out" }}>
              {isMyTurn ? "YOUR TURN" : `${currentPlayer?.guestName ?? "Player"}'s TURN`}
            </div>

            {/* Countdown */}
            {countdown !== null && (
              <div
                key={countdown}
                className="font-orbitron font-black text-7xl text-violet-400"
                style={{ animation: "countdownPop 0.4s ease-out" }}
              >
                {countdown}
              </div>
            )}
            {countdown === null && (
              <div className="font-orbitron text-cyan-400 text-xl animate-pulse">SPINNING...</div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 2d: Zoom-on-Landing Cinematic Overlay ─────────────────── */}
      {phase === "landing" && landingSegment && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center" style={{ background: "rgba(0,0,0,0.82)" }}>
          {/* Full-screen color burst */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${landingSegment.color}80 0%, ${landingSegment.color}30 35%, transparent 70%)`,
              animation: "colorFlash 1.0s ease-out forwards",
            }}
          />
          {/* Concentric ring pulses */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: `${(i + 1) * 120}px`,
                height: `${(i + 1) * 120}px`,
                border: `2px solid ${landingSegment.color}`,
                opacity: 0,
                animation: `colorFlash 0.8s ease-out ${i * 0.15}s forwards`,
              }}
            />
          ))}
          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center gap-5 text-center px-8">
            {/* Giant emoji zoom */}
            <div
              className="text-[96px] leading-none"
              style={{ animation: "segmentZoomIn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
            >
              {SEGMENT_EMOJIS[landingSegment.type]}
            </div>
            {/* Segment name with colored glow */}
            <div
              className="font-orbitron font-black text-4xl tracking-wider"
              style={{
                color: landingSegment.color,
                textShadow: `0 0 30px ${landingSegment.color}, 0 0 60px ${landingSegment.color}80`,
                animation: "segmentZoomIn 0.55s 0.12s cubic-bezier(0.34,1.56,0.64,1) both",
              }}
            >
              {SEGMENT_LABELS[landingSegment.type]}
            </div>
            {/* Points badge */}
            <div
              className="px-5 py-1.5 rounded-full font-orbitron font-bold text-sm"
              style={{
                background: `${landingSegment.color}25`,
                border: `1px solid ${landingSegment.color}60`,
                color: landingSegment.color,
                animation: "slideUpFade 0.4s 0.3s ease-out both",
              }}
            >
              SEGMENT UNLOCKED
            </div>
          </div>
        </div>
      )}

      {/* ── Main Layout ──────────────────────────────────────────────────── */}
      {/* On wide screens (landscape TV/tablet): side-by-side wheel + content */}
      <div className="relative z-10 flex flex-col h-full w-full">

        {/* TOP BAR — 40px fixed */}
        <div className="flex items-center justify-between px-3 py-2 flex-shrink-0 border-b border-white/5">
          <div className="text-xs font-orbitron text-gray-500">
            ROOM <span className="text-violet-400">{roomCode}</span>
          </div>
          <div className="text-xs font-orbitron text-gray-500">
            ROUND <span className="text-white">{room.roundNumber}</span>
          </div>
          {isHost && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHostControls((v) => !v)}
                className="text-xs text-gray-600 hover:text-violet-400 font-orbitron transition-colors"
                title="Host controls"
              >
                ⚙️
              </button>
              <button
                onClick={handleEndGame}
                className="text-xs text-gray-600 hover:text-red-400 font-orbitron transition-colors flex items-center gap-1"
              >
                <Trophy className="w-3 h-3" /> END
              </button>
            </div>
          )}
        </div>

        {/* HOST CONTROLS PANEL — Phase F */}
        {isHost && showHostControls && (
          <div className="flex-shrink-0 bg-black/80 border-b border-violet-500/30 px-3 py-2 space-y-2">
            <div className="text-[10px] font-orbitron text-violet-400 mb-1">HOST CONTROLS</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { resetPhaseMutation.mutate({ roomId: room.id }); setShowHostControls(false); }}
                disabled={resetPhaseMutation.isPending}
                className="text-xs font-orbitron px-3 py-1.5 rounded-lg bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/30 transition-colors disabled:opacity-50"
              >
                🔄 Reset Phase
              </button>
              <button
                onClick={() => { handleNextTurn(true); setShowHostControls(false); }}
                disabled={nextTurnMutation.isPending}
                className="text-xs font-orbitron px-3 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/30 transition-colors disabled:opacity-50"
              >
                ⏭ Force Next Turn
              </button>
              {players.filter(p => p.userId !== room.hostId).map(p => (
                <button
                  key={p.id}
                  onClick={() => { kickPlayerMutation.mutate({ roomId: room.id, playerId: p.id }); }}
                  disabled={kickPlayerMutation.isPending}
                  className="text-xs font-orbitron px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
                >
                  ❌ Kick {p.guestName ?? "Player"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section 2a: Game Show Podiums — sorted by score descending */}
        <div
          className="flex gap-1.5 px-3 py-2 flex-shrink-0 border-b border-white/5 items-end"
          style={{ overflowX: "auto", overflowY: "hidden", touchAction: "pan-x", minHeight: "88px" }}
        >
          {[...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((p, rank) => {
            const isActive = p.id === room.currentPlayerId;
            const isMe = p.id === myPlayer?.id;
            const avatarEmojis = ["🤖","👾","🦾","🧠","⚡","🔮","🎭","🔥","❄️","🌀","💀","🎲"];
            const emoji = avatarEmojis[(p.avatarIndex ?? 0) % avatarEmojis.length];
            const podiumH = rank === 0 ? "h-16" : rank === 1 ? "h-12" : "h-10";
            const glowColor = isActive ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.05)";
            return (
              <div key={p.id} className="flex-shrink-0 flex flex-col items-center gap-0.5" style={{ minWidth: "56px" }}>
                {/* Crown for rank 1 */}
                {rank === 0 && <div className="text-[10px]">👑</div>}
                {/* Avatar bubble */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all duration-300 ${isActive ? "ring-2 ring-violet-400 scale-110" : ""}`}
                  style={{
                    background: `radial-gradient(circle, rgba(109,40,217,0.4), rgba(0,0,0,0.6))`,
                    boxShadow: `0 0 12px ${glowColor}`,
                  }}
                >
                  {emoji}
                </div>
                {/* Podium base */}
                <div
                  className={`w-full ${podiumH} rounded-t-lg flex flex-col items-center justify-end pb-1 transition-all duration-500`}
                  style={{
                    background: isActive
                      ? "linear-gradient(180deg, rgba(139,92,246,0.5) 0%, rgba(109,40,217,0.3) 100%)"
                      : "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
                    border: isActive ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    borderBottom: "none",
                  }}
                >
                  <div className="text-[9px] font-orbitron font-bold truncate max-w-[52px] text-center" style={{ color: isActive ? "#c4b5fd" : isMe ? "#67e8f9" : "#9ca3af" }}>
                    {p.guestName?.split(" ")[0] ?? "?"}
                  </div>
                  <div className={`text-[11px] font-orbitron font-black ${(p.score ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {p.score ?? 0}
                  </div>
                  {(p.streak ?? 0) >= 2 && (
                    <div className="text-[8px] text-orange-400">{"🔥".repeat(Math.min(p.streak ?? 0, 3))}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* STAGE AREA — flex-1, switches between wheel and content */}
        {/* On landscape: wheel stays left, content right */}
        <div className="flex-1 min-h-0 relative overflow-hidden">

          {/* Wheel view */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3 transition-opacity duration-500"
            style={{ opacity: showWheel ? 1 : 0, pointerEvents: showWheel ? "auto" : "none" }}
          >
            <WheelSVG
              rotation={wheelAngle}
              isSpinning={isSpinning}
              size={Math.min(300, window.innerWidth - 40)}
              highlightSegmentIndex={!isSpinning && spinResult ? (spinResult.segmentIndex ?? null) : null}
            />
            {/* Fallback canvas for older browsers */}
            {false && <WheelCanvas rotation={wheelAngle} isSpinning={isSpinning} size={Math.min(300, window.innerWidth - 40)} />}
            <div className="text-center">
              {isMyTurn ? (
                <div className="text-sm font-bold font-orbitron text-violet-300 animate-pulse">
                  ⚡ YOUR TURN — SPIN THE WHEEL
                </div>
              ) : (
                <div className="text-sm text-gray-500 font-orbitron">
                  {currentPlayer?.guestName ?? "Someone"} is spinning...
                </div>
              )}
            </div>
          </div>

          {/* Content panel — result / voting / robot_attack */}
          <div
            className="absolute inset-0 flex flex-col overflow-y-auto px-3 py-3 gap-3 transition-opacity duration-300 lg:static lg:w-1/2 lg:opacity-100 lg:pointer-events-auto"
            style={{ opacity: showContent ? 1 : 0, pointerEvents: showContent ? "auto" : "none" }}
          >
            {/* Section 2e: Elevated Result Card — game show premium glass-morphism */}
            {(phase === "result" || phase === "landing" || phase === "answer_submission") && spinResult && (
              <div
                className="rounded-3xl border flex-shrink-0 overflow-hidden"
                style={{
                  background: isNegative
                    ? "linear-gradient(135deg, rgba(127,29,29,0.75) 0%, rgba(69,10,10,0.85) 100%)"
                    : `linear-gradient(135deg, ${segmentColor}18 0%, rgba(46,16,101,0.75) 50%, rgba(9,9,11,0.85) 100%)`,
                  borderColor: isNegative ? "rgba(239,68,68,0.4)" : `${segmentColor}50`,
                  boxShadow: isNegative
                    ? "0 8px 32px rgba(239,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.06)"
                    : `0 8px 32px ${segmentColor}25, inset 0 1px 0 rgba(255,255,255,0.06)`,
                  animation: "slideUpFade 0.4s ease-out",
                }}
              >
                {/* Top accent bar */}
                <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${segmentColor}, transparent)` }} />
                <div className="p-4 space-y-3">
                {/* Header: large emoji + segment name + points badge */}
                <div className="flex items-center gap-4">
                  {/* Emoji badge */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 relative"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${segmentColor}50, ${segmentColor}15)`,
                      border: `1.5px solid ${segmentColor}70`,
                      boxShadow: `0 4px 16px ${segmentColor}30`,
                    }}
                  >
                    {segmentEmoji}
                    {/* Shine overlay */}
                    <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-orbitron font-bold text-xs uppercase tracking-widest mb-0.5" style={{ color: `${segmentColor}cc` }}>
                      {SEGMENT_LABELS[spinResult.segmentType as SegmentType] ?? spinResult.segmentLabel}
                    </div>
                    {/* Points with animated counter feel */}
                    <div
                      className={`text-3xl font-black font-orbitron leading-none ${spinResult.pointsDelta >= 0 ? "text-green-400" : "text-red-400"}`}
                      style={{ textShadow: spinResult.pointsDelta >= 0 ? "0 0 20px rgba(74,222,128,0.5)" : "0 0 20px rgba(248,113,113,0.5)" }}
                    >
                      {spinResult.pointsDelta >= 0 ? "+" : ""}{spinResult.pointsDelta}
                      <span className="text-base font-bold ml-1 opacity-70">pts</span>
                    </div>
                    {/* Player name tag */}
                    <div className="text-xs text-gray-400 font-orbitron mt-0.5">
                      {currentPlayer?.guestName ?? "Player"}
                    </div>
                  </div>
                </div>

                {/* Giphy reaction GIF — holo_drama and after_dark only */}
                {showGiphy && spinResult && (
                  <GiphyReaction
                    segmentType={giphySegmentRef.current}
                    visible={showGiphy}
                    autoHideMs={7000}
                    onDismiss={() => setShowGiphy(false)}
                    className="w-full"
                  />
                )}

                {/* Challenge content — segment-aware panels (Bug 3+4) */}
                {spinResult.content && (
                  <div>
                    {spinResult.segmentType === "braincell_check" ? (
                      <div className="bg-black/40 rounded-xl p-3">
                        <TriviaPanel content={spinResult.content} isActive={isMyTurn} />
                      </div>
                    ) : spinResult.segmentType === "truth_cache" ? (
                      <TruthResponsePanel
                        roomId={room.id}
                        gameEventId={currentEventId ?? 0}
                        myPlayerId={myPlayerId}
                        activePlayerId={room.currentPlayerId ?? 0}
                        content={spinResult.content}
                        isActive={isMyTurn}
                        playerName={currentPlayer?.guestName ?? "Player"}
                        submittedAnswer={truthAnswer}
                        phase={(phase as string) === "voting" ? "voting" : (phase as string) === "answer_submission" ? "answer_submission" : "result"}
                        voteCounts={voteResultsQuery.data?.counts ?? {}}
                        totalVoters={players.length}
                        myVote={myVote}
                        timeLeft={voteTimeLeft}
                        onVote={(choice) => {
                          if (!room || !myPlayerId || !currentEventId) return;
                          setMyVote(choice);
                          voteCastMutation.mutate({ roomId: room.id, gameEventId: currentEventId, playerId: myPlayerId, choice });
                        }}
                      />
                    ) : spinResult.segmentType === "glitch_dare" ? (
                      <DareResponsePanel
                        roomId={room.id}
                        gameEventId={currentEventId ?? 0}
                        myPlayerId={myPlayerId}
                        activePlayerId={room.currentPlayerId ?? 0}
                        content={spinResult.content}
                        isActive={isMyTurn}
                        playerName={currentPlayer?.guestName ?? "Player"}
                        dareChoice={dareChoice}
                        phase={(phase as string) === "voting" ? "voting" : (phase as string) === "answer_submission" ? "answer_submission" : "result"}
                        voteCounts={voteResultsQuery.data?.counts ?? {}}
                        totalVoters={players.length}
                        myVote={myVote}
                        timeLeft={voteTimeLeft}
                        onVote={(choice) => {
                          if (!room || !myPlayerId || !currentEventId) return;
                          setMyVote(choice);
                          voteCastMutation.mutate({ roomId: room.id, gameEventId: currentEventId, playerId: myPlayerId, choice });
                        }}
                      />
                    ) : spinResult.segmentType === "prompt_duel" ? (
                      <DuelResponsePanel
                        roomId={room.id}
                        gameEventId={currentEventId ?? 0}
                        myPlayerId={myPlayerId}
                        activePlayerId={room.currentPlayerId ?? 0}
                        content={spinResult.content}
                        isActive={isMyTurn}
                        isDuelOpponent={!isMyTurn && !!myPlayer && myPlayer.id !== room.currentPlayerId}
                        activeName={currentPlayer?.guestName ?? "Player 1"}
                        opponentName={players.find((p) => p.id !== room.currentPlayerId)?.guestName ?? "Player 2"}
                        activeAnswer={duelAnswerA}
                        opponentAnswer={duelAnswerB}
                        phase={(phase as string) === "voting" ? "voting" : (phase as string) === "answer_submission" ? "answer_submission" : "result"}
                        voteCounts={voteResultsQuery.data?.counts ?? {}}
                        totalVoters={players.length}
                        myVote={myVote}
                        timeLeft={voteTimeLeft}
                        onVote={(choice) => {
                          if (!room || !myPlayerId || !currentEventId) return;
                          setMyVote(choice);
                          voteCastMutation.mutate({ roomId: room.id, gameEventId: currentEventId, playerId: myPlayerId, choice });
                        }}
                      />
                    ) : (
                      <div className="bg-black/40 rounded-xl p-3 leading-relaxed">
                        <div className="text-base text-gray-200 whitespace-pre-line italic border-l-4 border-violet-500 pl-3">
                          {spinResult.content}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Vote results summary */}
                {voteResultsQuery.data && voteResultsQuery.data.total > 0 && (
                  <div className="bg-black/30 rounded-xl p-3 text-xs font-orbitron text-gray-400">
                    <div className="mb-1 text-gray-500">VOTE RESULTS</div>
                    {Object.entries(voteResultsQuery.data.counts).map(([choice, count]) => (
                      <div key={choice} className="flex justify-between">
                        <span>{getChoiceLabel(choice, spinResult?.segmentType)}</span>
                        <span className="text-violet-400">{count} vote{count !== 1 ? "s" : ""}</span>
                      </div>
                    ))}
                    <div className="mt-1 text-cyan-400">Winner: {getChoiceLabel(voteResultsQuery.data.winner, spinResult?.segmentType) || "—"}</div>
                  </div>
                )}

                {/* Part 1: Share This Moment button — appears on every result */}
                {spinResult && (
                  <button
                    onClick={() => {
                      const segLabel = SEGMENT_LABELS[spinResult.segmentType as SegmentType] ?? spinResult.segmentLabel;
                      const playerName = currentPlayer?.guestName ?? "Someone";
                      const pts = spinResult.pointsDelta >= 0 ? `+${spinResult.pointsDelta}` : `${spinResult.pointsDelta}`;
                      const content = spinResult.content ? `\n"${spinResult.content.slice(0, 120)}${spinResult.content.length > 120 ? "..." : ""}"` : "";
                      const text = `🎡 ${playerName} just spun ${segLabel} (${pts} pts)!${content}\n\nPlay AI4U Party Wheel FREE 👇\nhttps://ai4uparty.manus.space`;
                      if (navigator.share) {
                        navigator.share({ title: "AI4U Party Wheel Moment", text }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(text).then(() => {
                          toast.success("📋 Moment copied! Paste it anywhere.");
                        }).catch(() => {
                          toast.error("Couldn't copy. Try manually.");
                        });
                      }
                    }}
                    className="w-full py-2 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-orbitron hover:bg-violet-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    📱 SHARE THIS MOMENT
                  </button>
                )}
                {/* Next turn — active player button; host can force-advance; others see waiting */}
                {isMyTurn ? (
                  <Button
                    onClick={() => handleNextTurn(false)}
                    disabled={nextTurnMutation.isPending}
                    className="w-full h-[60px] bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 font-orbitron font-bold border-0 rounded-xl text-base"
                  >
                    <SkipForward className="w-5 h-5 mr-2" />
                    {nextTurnMutation.isPending ? "..." : "NEXT TURN →"}
                  </Button>
                ) : isHost ? (
                  <Button
                    onClick={() => handleNextTurn(true)}
                    disabled={nextTurnMutation.isPending}
                    className="w-full h-[60px] bg-white/10 hover:bg-white/15 border border-white/20 font-orbitron font-bold rounded-xl text-sm text-gray-400"
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    {nextTurnMutation.isPending ? "..." : "FORCE NEXT TURN (HOST)"}
                  </Button>
                ) : (
                  <div className="w-full space-y-2">
                    <div className="h-[60px] flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-sm font-orbitron text-gray-500">
                      ⏳ Waiting for {currentPlayer?.guestName ?? "player"} to continue...
                    </div>
                    {voteTimeLeft <= 5 && voteTimeLeft > 0 && (
                      <div className="text-xs font-orbitron text-yellow-500 animate-pulse text-center">
                        {voteTimeLeft}s remaining
                      </div>
                    )}
                    {voteTimeLeft <= 0 && phase === "result" && (
                      <div className="text-xs font-orbitron text-yellow-600 text-center bg-yellow-500/10 p-2 rounded">
                        Game seems stuck? Ask the host to use Force Next Turn
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}
            {/* Voting panel — visible to ALL players with challenge text */}
            {phase === "voting" && (
              <div className="space-y-3 flex-shrink-0">
                {/* Challenge text above voting options */}
                {spinResult?.content && (
                  <div className="bg-black/40 rounded-xl p-3 border border-cyan-500/30">
                    <div className="text-xs font-orbitron text-cyan-400 mb-1">CHALLENGE:</div>
                    <div className="text-base text-white font-semibold leading-snug">{spinResult.content}</div>
                  </div>
                )}
                <VotingPanel
                  options={votingOptions}
                  onVote={(choice) => {
                    if (!room || !myPlayerId || !currentEventId) {
                      toast.error("Vote error: missing context");
                      return;
                    }
                    setMyVote(choice);
                    voteCastMutation.mutate({
                      roomId: room.id,
                      gameEventId: currentEventId,
                      playerId: myPlayerId,
                      choice,
                    });
                  }}
                  myVote={myVote}
                  title={SEGMENT_LABELS[(spinResult?.segmentType ?? room.currentPhase) as SegmentType] ?? "CROWD VOTE"}
                  timeLeft={voteTimeLeft}
                  voteCounts={voteResultsQuery.data?.counts ?? {}}
                  totalVoters={players.length}
                />
              </div>
            )}

            {/* Robot attack phase */}
            {phase === "robot_attack" && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-4">
                  <div className="text-red-400 font-orbitron font-bold animate-pulse text-lg">
                    ⚠️ AI4U ROBOT ATTACK ⚠️
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM BAR — spin button or status */}
        <div
          className="flex-shrink-0 px-3 pb-4 pt-2 border-t border-white/5"
          style={{ minHeight: "80px" }}
        >
          {phase === "waiting" && (
            <div className="flex justify-center">
              <SpinButton
                onSpin={handleSpin}
                disabled={isSpinning || !isMyTurn}
                isMyTurn={isMyTurn}
              />
            </div>
          )}
          {(phase === "spinning" || phase === "spin_preview") && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-violet-400 font-orbitron text-sm animate-pulse">
                {phase === "spin_preview" ? "GET READY..." : "SPINNING..."}
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          {(phase === "result" || phase === "voting" || phase === "landing" || phase === "robot_attack" || phase === "answer_submission") && (
            <div className="text-center text-xs font-orbitron text-gray-600">
              {phase === "voting" ? `⏱ ${voteTimeLeft}s` : ""}
              {botAdvanceCountdown !== null && (
                <div className="text-xs font-orbitron text-gray-600 text-center mt-1">
                  Auto-advancing in {botAdvanceCountdown}s
                </div>
              )}
            </div>
          )}
        </div>

        {/* Copyright footer */}
        <CopyrightFooter className="flex-shrink-0" />
      </div>

      {/* Real-time chat */}
      {room && myPlayerId && (
        <GameChat
          roomId={room.id}
          roomCode={roomCode}
          myPlayerId={myPlayerId}
          myPlayerName={myPlayer?.guestName ?? "Player"}
          myAvatarIndex={myPlayer?.avatarIndex ?? 0}
          liveMessages={liveMessages as any}
        />
      )}
    </div>
    </GameStageShell>
  );
}
