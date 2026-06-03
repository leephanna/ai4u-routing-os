import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { BOT_PERSONALITIES, BotPersonalityKey } from "@shared/gameTypes";

interface BotPlayer {
  id: number;
  name: string;
  botPersonality: string;
  avatarIndex: number;
}

interface RoomState {
  id: number;
  code: string;
  status: string;
  currentPhase: string | null;
  currentPlayerId: number | null;
  currentEventId: number | null;
  intensity: string;
  lastSpinResultJson?: unknown;
}

interface UseBotEngineProps {
  room: RoomState | null | undefined;
  botPlayers: BotPlayer[];
  myPlayerId: number | null;
  isHost: boolean;
}

/** Extract segment type from lastSpinResultJson (may be object or JSON string) */
function extractSegmentType(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "object" && raw !== null) {
    return (raw as Record<string, unknown>).segmentType as string ?? "";
  }
  if (typeof raw === "string") {
    try { return (JSON.parse(raw) as { segmentType?: string }).segmentType ?? ""; } catch { return ""; }
  }
  return "";
}

/** Generate a plausible bot truth answer */
function botTruthAnswer(botName: string): string {
  const answers = [
    `${botName} once tried to hack the mainframe but got distracted by a cat video.`,
    `${botName} secretly prefers decaf.`,
    `${botName} has never actually read the terms of service.`,
    `${botName} once pretended to be offline to avoid a meeting.`,
    `${botName} thinks pineapple on pizza is acceptable.`,
    `${botName} has 47 unread emails and no intention of reading them.`,
  ];
  return answers[Math.floor(Math.random() * answers.length)];
}

/** Generate a plausible bot duel answer */
function botDuelAnswer(botName: string, prompt: string): string {
  const starters = [
    `${botName} would say: `,
    `Obviously, `,
    `In my expert opinion, `,
    `${botName} believes that `,
  ];
  const fillers = [
    "the answer is clearly 42.",
    "anyone who disagrees is running on outdated firmware.",
    "this is a feature, not a bug.",
    "the cloud is just someone else's computer.",
    "we should reboot and try again.",
    "the real treasure was the latency we accumulated along the way.",
  ];
  const _ = prompt; // acknowledge param
  return starters[Math.floor(Math.random() * starters.length)] +
    fillers[Math.floor(Math.random() * fillers.length)];
}

/**
 * useBotEngine — drives bot player actions on the host's device.
 * Only the host runs the bot engine to avoid duplicate actions.
 */
export function useBotEngine({ room, botPlayers, myPlayerId, isHost }: UseBotEngineProps) {
  const pendingBotAction = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProcessedPhase = useRef<string | null>(null);
  const lastProcessedActivePlayer = useRef<number | null>(null);
  // Track which bots have already voted/submitted for the current event to prevent duplicates
  const alreadyActedBots = useRef<Set<string>>(new Set());

  const spinMutation = trpc.game.spin.useMutation();
  const nextTurnMutation = trpc.game.nextTurn.useMutation();
  const chatSendMutation = trpc.chat.send.useMutation();
  const voteCastMutation = trpc.voting.cast.useMutation();
  const submitChallengeMutation = trpc.challenge.submitResponse.useMutation();

  const sendBotChat = useCallback(async (
    bot: BotPlayer,
    quipCategory: keyof typeof BOT_PERSONALITIES[BotPersonalityKey]["chatQuips"]
  ) => {
    if (!room) return;
    const personality = BOT_PERSONALITIES[bot.botPersonality as BotPersonalityKey];
    if (!personality) return;
    const quips = personality.chatQuips[quipCategory];
    const quip = quips[Math.floor(Math.random() * quips.length)];
    if (!quip) return;
    try {
      await chatSendMutation.mutateAsync({
        roomCode: room.code,
        roomId: room.id,
        playerId: bot.id,
        playerName: bot.name,
        avatarIndex: bot.avatarIndex,
        message: quip,
        isBot: true,
      });
    } catch { /* ignore */ }
  }, [room, chatSendMutation]);

  useEffect(() => {
    if (!isHost || !room || room.status !== "playing" || botPlayers.length === 0) return;

    const currentPhase = room.currentPhase;
    const stateKey = `${currentPhase}-${room.currentPlayerId}-${room.currentEventId}`;
    const lastKey = `${lastProcessedPhase.current}-${lastProcessedActivePlayer.current}-${room.currentEventId}`;
    if (stateKey === lastKey) return;

    // FIX 3: landing_closeup is handled server-side (auto-advances after 5s) — bots wait
    if (currentPhase === "landing_closeup") {
      lastProcessedPhase.current = currentPhase;
      lastProcessedActivePlayer.current = room.currentPlayerId;
      return;
    }

    const activeBotPlayer = botPlayers.find(b => b.id === room.currentPlayerId);
    const segmentType = extractSegmentType(room.lastSpinResultJson);

    // ── WAITING: active bot spins ──────────────────────────────────────────
    if (currentPhase === "waiting" && activeBotPlayer && room.currentPlayerId) {
      lastProcessedPhase.current = currentPhase;
      lastProcessedActivePlayer.current = room.currentPlayerId;
      alreadyActedBots.current.clear();

      const personality = BOT_PERSONALITIES[activeBotPlayer.botPersonality as BotPersonalityKey];
      if (!personality) return;
      const [minDelay, maxDelay] = personality.spinDelayMs;
      const delay = minDelay + Math.random() * (maxDelay - minDelay);

      if (pendingBotAction.current) clearTimeout(pendingBotAction.current);
      pendingBotAction.current = setTimeout(async () => {
        try {
          await sendBotChat(activeBotPlayer, "beforeSpin");
          const botVelocity = 8 + Math.random() * 10;
          await spinMutation.mutateAsync({
            roomId: room.id,
            playerId: activeBotPlayer.id,
            velocity: botVelocity,
          });
        } catch { /* ignore */ }
      }, delay);
    }

    // ── ANSWER_SUBMISSION: bots submit their challenge responses ───────────
    if (currentPhase === "answer_submission" && room.currentEventId) {
      lastProcessedPhase.current = currentPhase;
      lastProcessedActivePlayer.current = room.currentPlayerId;

      if (pendingBotAction.current) clearTimeout(pendingBotAction.current);
      pendingBotAction.current = setTimeout(async () => {
        const eventId = room.currentEventId!;

        for (const bot of botPlayers) {
          const actKey = `${eventId}-submit-${bot.id}`;
          if (alreadyActedBots.current.has(actKey)) continue;

          if (segmentType === "truth_cache" && bot.id === room.currentPlayerId) {
            // Active bot submits their truth answer
            alreadyActedBots.current.add(actKey);
            try {
              await submitChallengeMutation.mutateAsync({
                roomId: room.id,
                gameEventId: eventId,
                playerId: bot.id,
                segmentType: "truth_cache",
                responseType: "truth_answer",
                textResponse: botTruthAnswer(bot.name),
              });
            } catch { /* ignore */ }
          } else if (segmentType === "glitch_dare" && bot.id === room.currentPlayerId) {
            // Active bot accepts or skips dare (70% accept)
            alreadyActedBots.current.add(actKey);
            const accepts = Math.random() > 0.3;
            try {
              await submitChallengeMutation.mutateAsync({
                roomId: room.id,
                gameEventId: eventId,
                playerId: bot.id,
                segmentType: "glitch_dare",
                responseType: accepts ? "dare_accept" : "dare_skip",
              });
            } catch { /* ignore */ }
          } else if (segmentType === "prompt_duel") {
            // Both active bot and opponent bot submit answers
            const isActiveBot = bot.id === room.currentPlayerId;
            const isOpponentBot = !isActiveBot && botPlayers.some(b => b.id !== room.currentPlayerId);
            if (isActiveBot || isOpponentBot) {
              alreadyActedBots.current.add(actKey);
              const spinContent = typeof room.lastSpinResultJson === "object" && room.lastSpinResultJson !== null
                ? (room.lastSpinResultJson as Record<string, unknown>).content as string ?? ""
                : "";
              try {
                await submitChallengeMutation.mutateAsync({
                  roomId: room.id,
                  gameEventId: eventId,
                  playerId: bot.id,
                  segmentType: "prompt_duel",
                  responseType: "duel_answer",
                  textResponse: botDuelAnswer(bot.name, spinContent),
                });
              } catch { /* ignore */ }
            }
          }

          await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
        }
      }, 1500 + Math.random() * 1000);
    }

    // ── VOTING: bots cast votes with normalized IDs ────────────────────────
    if (currentPhase === "voting" && room.currentEventId) {
      lastProcessedPhase.current = currentPhase;
      lastProcessedActivePlayer.current = room.currentPlayerId;

      if (pendingBotAction.current) clearTimeout(pendingBotAction.current);
      pendingBotAction.current = setTimeout(async () => {
        const eventId = room.currentEventId!;

        for (const bot of botPlayers) {
          // Active player doesn't vote on their own segment
          if (bot.id === room.currentPlayerId) continue;

          const actKey = `${eventId}-vote-${bot.id}`;
          if (alreadyActedBots.current.has(actKey)) continue;
          alreadyActedBots.current.add(actKey);

          // Pick normalized vote choice based on segment type
          let voteChoice: string;
          if (segmentType === "truth_cache") {
            voteChoice = Math.random() > 0.3 ? "yes" : "no";
          } else if (segmentType === "glitch_dare") {
            voteChoice = Math.random() > 0.35 ? "pass" : "fail";
          } else if (segmentType === "prompt_duel") {
            voteChoice = Math.random() > 0.5 ? "player_a" : "player_b";
          } else {
            // crowd_override
            voteChoice = Math.random() > 0.5 ? "option_a" : "option_b";
          }

          try {
            await voteCastMutation.mutateAsync({
              roomId: room.id,
              gameEventId: eventId,
              playerId: bot.id,
              choice: voteChoice,
            });
          } catch { /* ignore duplicate vote errors */ }

          await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
        }
      }, 2000 + Math.random() * 2000);
    }

    // ── RESULT: bots react with quips; active bot advances turn ───────────
    if (currentPhase === "result" && room.currentPlayerId) {
      lastProcessedPhase.current = currentPhase;
      lastProcessedActivePlayer.current = room.currentPlayerId;

      const activeBotInRoom = botPlayers.find(b => b.id === room.currentPlayerId);
      const otherBots = botPlayers.filter(b => b.id !== room.currentPlayerId);

      if (pendingBotAction.current) clearTimeout(pendingBotAction.current);
      pendingBotAction.current = setTimeout(async () => {
        if (activeBotInRoom) {
          const quipType = Math.random() > 0.5 ? "afterWin" : "afterLoss";
          await sendBotChat(activeBotInRoom, quipType);
        }
        for (const bot of otherBots.slice(0, 1)) {
          await new Promise(r => setTimeout(r, 800));
          await sendBotChat(bot, "reactionToOthers");
        }
        if (activeBotInRoom && isHost) {
          // FIX 4: Extended delay so human players can read the result card (60 seconds)
          await new Promise(r => setTimeout(r, 60000));
          try {
            await nextTurnMutation.mutateAsync({
              roomId: room.id,
              playerId: activeBotInRoom.id,
            });
          } catch (err) {
            console.warn("[BotEngine] nextTurn failed, retrying in 3s:", err);
            await new Promise(r => setTimeout(r, 3000));
            try {
              await nextTurnMutation.mutateAsync({
                roomId: room.id,
                playerId: activeBotInRoom.id,
                forceByHost: true,
              });
            } catch { /* give up — host can use Force Next Turn */ }
          }
        }
      }, 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.currentPhase, room?.currentPlayerId, room?.status, room?.currentEventId, isHost, botPlayers, sendBotChat, spinMutation, nextTurnMutation, voteCastMutation, submitChallengeMutation, room]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingBotAction.current) clearTimeout(pendingBotAction.current);
    };
  }, []);
}
