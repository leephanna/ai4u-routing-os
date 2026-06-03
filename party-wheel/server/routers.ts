import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import {
  createRoom, getRoomByCode, getRoomById, updateRoom,
  createPlayer, getPlayersInRoom, getPlayerById, updatePlayer,
  createGameEvent, getGameEventsForRoom, getGameEventById,
  upsertVote, castVote, getVotesForEvent,
  createReplayCard, getReplayCardByToken, getReplayCardByRoomId,
  getPlayerByGuestSession, removePlayer,
  createChatMessage, getRecentChatMessages,
  upsertChallengeResponse, getChallengeResponsesForEvent,
} from "./db";
import { buildWheelSegments, SEGMENT_LABELS, SEGMENT_POINTS, BOT_PERSONALITIES, BotPersonalityKey, VOTE_CHOICES } from "@shared/gameTypes";
import { getIntensitySystemPrompt } from "@shared/intensityTiers";
import { broadcastRoomEvent } from "./realtime";
import { logGeneratedContent, validateContent } from "./contentLogger";
import { recordContentUsage, hasContentBeenUsedRecently } from "./contentRecency";

// ── Helpers ────────────────────────────────────────────────────────────────
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateShareToken(): string {
  return nanoid(20);
}

/** Compute segment index from a finalAngle (radians) and segment count */
function angleToSegmentIndex(finalAngle: number, segmentCount: number): number {
  const normalizedAngle = ((2 * Math.PI - (finalAngle % (2 * Math.PI))) + 2 * Math.PI) % (2 * Math.PI);
  return Math.floor(normalizedAngle / ((2 * Math.PI) / segmentCount)) % segmentCount;
}

// ── Content moderation: block policy-violating LLM output ─────────────────
const BLOCKED_PATTERNS = [
  /\b(explicit sex acts?|full nudity|genitals?|penis|vagina|rape|sexual assault|molest)\b/i,
  /\b(kill yourself|kys|suicide method|self.harm instructions)\b/i,
  /\b(meth recipe|heroin|fentanyl synthesis|drug recipe|how to make cocaine)\b/i,
  /\b(child|minor|underage|teen|kid)\b.*\b(sex|nude|naked|explicit)\b/i,
];

function moderateContent(text: string): string {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return "The AI4U robot detected a policy violation and replaced this prompt. Try again!";
    }
  }
  return text;
}

// ── Room Router ────────────────────────────────────────────────────────────
const roomRouter = router({
  create: protectedProcedure
    .input(z.object({
      hostName: z.string().min(1).max(32),
      avatarIndex: z.number().int().min(0).max(11),
      intensity: z.enum(["house_party", "after_dark", "chaos_mode"]).default("house_party"),
      soloMode: z.boolean().optional(), // Part 6: auto-add 2 bots and start
    }))
    .mutation(async ({ ctx, input }) => {
      let code = generateRoomCode();
      for (let i = 0; i < 5; i++) {
        const existing = await getRoomByCode(code);
        if (!existing) break;
        code = generateRoomCode();
      }

      await createRoom({
        code,
        hostId: ctx.user.id,
        status: "waiting",
        intensity: input.intensity,
        currentTurn: 0,
        roundNumber: 1,
        maxPlayers: 8,
        currentPhase: "lobby",
      });

      const room = await getRoomByCode(code);
      if (!room) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create room" });

      await createPlayer({
        roomId: room.id,
        userId: ctx.user.id,
        guestName: input.hostName,
        avatarIndex: input.avatarIndex,
        isHost: true,
        turnOrder: 0,
      });

      // Part 6: solo mode — add 2 bots automatically
      if (input.soloMode) {
        const BOT_SOLO_PICKS: BotPersonalityKey[] = ["CHAOS_GREMLIN", "HYPE_BOT"];
        for (const personality of BOT_SOLO_PICKS) {
          const p = BOT_PERSONALITIES[personality];
          await createPlayer({
            roomId: room.id,
            guestName: p.name,
            avatarIndex: p.avatarIndex,
            isBot: true,
            botPersonality: personality,
            turnOrder: (await getPlayersInRoom(room.id)).length,
            isHost: false,
            isActive: true,
          });
        }
      }
      await notifyOwner({
        title: "New Party Room Created",
        content: `Room ${code} created by ${input.hostName} (intensity: ${input.intensity})${input.soloMode ? " [SOLO]" : ""}`,
      }).catch(() => {});
      return { code, roomId: room.id, soloMode: input.soloMode ?? false };
    }),

  /** Phase A: guests join without OAuth — guestSessionId stored in localStorage */
  join: publicProcedure
    .input(z.object({
      code: z.string().length(6),
      playerName: z.string().min(1).max(32),
      avatarIndex: z.number().int().min(0).max(11),
      guestSessionId: z.string().min(8).max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const room = await getRoomByCode(input.code.toUpperCase());
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      if (room.status !== "waiting") throw new TRPCError({ code: "BAD_REQUEST", message: "Game already started" });

      const existingPlayers = await getPlayersInRoom(room.id);
      if (existingPlayers.length >= 8) throw new TRPCError({ code: "BAD_REQUEST", message: "Room is full (max 8 players)" });

      // Prevent duplicate join: check by userId or guestSessionId
      const userId = ctx.user?.id;
      const guestSessionId = input.guestSessionId;

      if (userId) {
        const alreadyIn = existingPlayers.find(p => p.userId === userId);
        if (alreadyIn) {
          const updatedPlayers = await getPlayersInRoom(room.id);
          return { roomId: room.id, code: room.code, players: updatedPlayers, intensity: room.intensity, hostId: room.hostId, playerId: alreadyIn.id };
        }
      } else if (guestSessionId) {
        const alreadyIn = await getPlayerByGuestSession(room.id, guestSessionId);
        if (alreadyIn) {
          const updatedPlayers = await getPlayersInRoom(room.id);
          return { roomId: room.id, code: room.code, players: updatedPlayers, intensity: room.intensity, hostId: room.hostId, playerId: alreadyIn.id };
        }
      }

      const newPlayer = await createPlayer({
        roomId: room.id,
        userId: userId ?? null,
        guestSessionId: guestSessionId ?? null,
        guestName: input.playerName,
        avatarIndex: input.avatarIndex,
        isHost: false,
        turnOrder: existingPlayers.length,
      });

      const updatedPlayers = await getPlayersInRoom(room.id);

      broadcastRoomEvent(room.code, "player_joined", {
        players: updatedPlayers,
        roomId: room.id,
      }).catch(() => {});

      // Part 4: write guestSessionId as HTTP cookie so server-side identity lookup works
      if (input.guestSessionId && !ctx.user) {
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie("ai4u_guest_session_id", input.guestSessionId, {
          ...cookieOptions,
          maxAge: 4 * 60 * 60 * 1000, // 4 hours
          httpOnly: false, // must be readable by client localStorage sync
        });
      }
      return {
        roomId: room.id,
        code: room.code,
        players: updatedPlayers,
        intensity: room.intensity,
        hostId: room.hostId,
        playerId: (newPlayer as any)?.insertId ?? undefined,
      };
    }),
  get: publicProcedure
    .input(z.object({ code: z.string().length(6) }))
    .query(async ({ ctx, input }) => {
      const room = await getRoomByCode(input.code.toUpperCase());
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      const roomPlayers = await getPlayersInRoom(room.id);

      // Bug 6: compute myPlayerId server-side so guests can identify themselves
      const guestSessionId: string | null =
        (ctx.req as any)?.cookies?.["ai4u_guest_session_id"] ?? null;
      const myPlayer = roomPlayers.find((p) =>
        (ctx.user?.id && p.userId === ctx.user.id) ||
        (guestSessionId && p.guestSessionId === guestSessionId)
      );

      return { ...room, players: roomPlayers, myPlayerId: myPlayer?.id ?? null };
    }),

  setIntensity: protectedProcedure
    .input(z.object({
      roomId: z.number(),
      intensity: z.enum(["house_party", "after_dark", "chaos_mode"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only host can change intensity" });
      await updateRoom(input.roomId, { intensity: input.intensity });
      return { success: true };
    }),
});

// ── Game Router ────────────────────────────────────────────────────────────
const gameRouter = router({
  /** Phase B: host-only, min 2 players, clears all phase fields */
  start: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only host can start" });

      const roomPlayers = await getPlayersInRoom(input.roomId);
      if (roomPlayers.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "Need at least 2 players to start" });

      const firstPlayer = roomPlayers[0];
      await updateRoom(input.roomId, {
        status: "playing",
        currentPlayerId: firstPlayer?.id,
        currentTurn: 1,
        currentPhase: "waiting",
        currentEventId: null,
        lastSpinResultJson: null,
        lastSpinVelocity: null,
        spinId: null,
        spinStartedAt: null,
        spinDurationMs: null,
        finalAngle: null,
        segmentIndex: null,
      });

      const startedRoom = await getRoomById(input.roomId);
      if (startedRoom) {
        const startedPlayers = await getPlayersInRoom(input.roomId);
        broadcastRoomEvent(startedRoom.code, "game_started", {
          status: "playing",
          currentPlayerId: firstPlayer?.id,
          currentPhase: "waiting",
          players: startedPlayers,
        }).catch(() => {});
      }

      return { success: true, firstPlayerId: firstPlayer?.id };
    }),

  /** Phase B+D: active-player-only, phase=waiting check, fully server-side spin */
  spin: publicProcedure
    .input(z.object({
      roomId: z.number(),
      playerId: z.number(),
      /** Client still sends velocity for animation smoothness, but server generates its own */
      velocity: z.number().min(1).max(50).optional(),
    }))
    .mutation(async ({ input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.status !== "playing") throw new TRPCError({ code: "BAD_REQUEST", message: "Game not active" });

      // Phase B: only currentPlayerId may spin
      if (room.currentPlayerId !== input.playerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "It's not your turn to spin" });
      }
      // Phase B: reject if not in waiting phase
      if (room.currentPhase !== "waiting") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot spin in phase: ${room.currentPhase}` });
      }

      // Phase D: server-side deterministic spin
      const spinId = nanoid(16);
      const serverVelocity = 8 + Math.random() * 12; // 8–20 rps
      const spinDurationMs = Math.round(3000 + Math.random() * 2000); // 3–5 seconds
      const totalRotations = serverVelocity * (spinDurationMs / 1000);
      const finalAngle = (totalRotations * 2 * Math.PI) % (2 * Math.PI);
      const spinStartedAt = new Date();

      const segments = buildWheelSegments();
      const segmentCount = segments.length;
      const segmentIndex = angleToSegmentIndex(finalAngle, segmentCount);
      const segment = segments[segmentIndex];

      if (!segment) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid segment" });

      // Fetch active player name for broadcast payload
      const activePlayer = await getPlayerById(input.playerId);
      const activePlayerName = activePlayer?.guestName ?? "Player";

      // Write spin_committed phase immediately so all clients can start animating
      await updateRoom(input.roomId, {
        currentPhase: "spinning",
        spinId,
        spinStartedAt,
        spinDurationMs,
        finalAngle,
        segmentIndex,
        lastSpinVelocity: serverVelocity,
      });

      // Broadcast spinning phase with full payload for deterministic animation
      broadcastRoomEvent(room.code, "spin_committed", {
        spinId,
        roomId: input.roomId,
        activePlayerId: input.playerId,
        activePlayerName,
        velocity: serverVelocity,
        spinStartedAt: spinStartedAt.getTime(),
        spinDurationMs,
        finalAngle,
        segmentIndex,
        segmentType: segment.type,
        segmentLabel: segment.label,
        chargePercent: 1.0,
        currentPhase: "spinning",
      }).catch(() => {});

      // Get LLM content
      let content = "";
      try {
        const roomPlayers = await getPlayersInRoom(input.roomId);
        const playerNames = roomPlayers.map(p => p.guestName ?? "Player").filter(Boolean);
        content = await generateSegmentContent(segment.type as SegmentTypeStr, room.intensity, playerNames);
        content = moderateContent(content);
      } catch {
        content = getDefaultContent(segment.type);
      }

      const pointsDelta = Math.round(segment.points * (activePlayer?.chaosMultiplier ?? 1));

      const gameEvent = await createGameEvent({
        roomId: input.roomId,
        playerId: input.playerId,
        roundNumber: room.roundNumber,
        segmentType: segment.type,
        segmentLabel: segment.label,
        content,
        spinVelocity: serverVelocity,
        pointsDelta,
      });
      const gameEventId = gameEvent?.id ?? 0;

      // Phase progression: spinning -> landing_closeup -> challenge/voting/result
      const isVotingSegment = ["prompt_duel", "crowd_override", "truth_cache", "glitch_dare"].includes(segment.type);
      const newPhase = "landing_closeup";

      const spinResultPayload = {
        spinId,
        roomId: input.roomId,
        activePlayerId: input.playerId,
        velocity: serverVelocity,
        spinStartedAt: spinStartedAt.getTime(),
        spinDurationMs,
        finalAngle,
        segmentIndex,
        segmentType: segment.type,
        segmentLabel: segment.label,
        pointsDelta,
        content,
        gameEventId,
      };

      await updateRoom(input.roomId, {
        currentPhase: newPhase,
        currentEventId: gameEventId,
        lastSpinResultJson: spinResultPayload,
      });

      broadcastRoomEvent(room.code, "room_update", {
        currentPhase: newPhase,
        currentEventId: gameEventId,
        lastSpinResultJson: spinResultPayload,
        lastSpinVelocity: serverVelocity,
        currentPlayerId: input.playerId,
      }).catch(() => {});

      // FIX 1: Auto-advance from landing_closeup to result/voting/answer_submission after 5s
      // This runs server-side so ALL clients get the phase update via polling/Realtime
      const LANDING_DURATION_MS = 5000;
      setTimeout(async () => {
        try {
          const freshRoom = await getRoomById(input.roomId);
          if (!freshRoom || freshRoom.currentPhase !== "landing_closeup") return; // already advanced
          
          let nextPhase: string;
          if (segment.type === "truth_cache" || segment.type === "glitch_dare") {
            nextPhase = "answer_submission";
          } else if (segment.type === "prompt_duel" || segment.type === "crowd_override") {
            nextPhase = "voting";
          } else {
            nextPhase = "result";
          }
          
          await updateRoom(input.roomId, { currentPhase: nextPhase });
          broadcastRoomEvent(freshRoom.code, "room_update", {
            currentPhase: nextPhase,
            currentEventId: gameEventId,
            lastSpinResultJson: spinResultPayload,
          }).catch(() => {});
        } catch (err) {
          console.error("[game.spin] Failed to auto-advance from landing_closeup:", err);
        }
      }, LANDING_DURATION_MS);

      // Update player score for non-voting segments immediately
      if (!isVotingSegment && activePlayer) {
        const newScore = Math.max(0, (activePlayer.score ?? 0) + pointsDelta);
        const newStreak = pointsDelta > 0 ? (activePlayer.streak ?? 0) + 1 : 0;
        const newChaos = newStreak >= 3 ? Math.min((activePlayer.chaosMultiplier ?? 1) * 1.25, 3.0) : (activePlayer.chaosMultiplier ?? 1);
        await updatePlayer(input.playerId, { score: newScore, streak: newStreak, chaosMultiplier: newChaos });
      }

      return spinResultPayload;
    }),

  /** Phase B+F: active player OR host override may advance */
  nextTurn: publicProcedure
    .input(z.object({
      roomId: z.number(),
      playerId: z.number().optional(),
      forceByHost: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });

      // Authorization: active player or host override
      if (input.forceByHost) {
        // Host override — log it (no auth check here since host may be guest)
        console.info(`[game.nextTurn] force_next_turn by host for room ${room.code}`);
      } else if (input.playerId && room.currentPlayerId !== input.playerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the active player can advance the turn" });
      }

      // Fix: sort players by turnOrder to prevent duplicate turns
      const roomPlayers = (await getPlayersInRoom(input.roomId))
        .filter(p => p.isActive)
        .sort((a, b) => (a.turnOrder ?? 0) - (b.turnOrder ?? 0));

      if (roomPlayers.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No active players" });

      const currentIndex = roomPlayers.findIndex(p => p.id === room.currentPlayerId);
      const nextIndex = (currentIndex + 1) % roomPlayers.length;
      const nextPlayer = roomPlayers[nextIndex];

      const newTurn = (room.currentTurn ?? 0) + 1;
      const newRound = nextIndex === 0 ? (room.roundNumber ?? 1) + 1 : (room.roundNumber ?? 1);

      // Auto-end game after 3 rounds × player count
      const maxRounds = 3;
      if (newRound > maxRounds && nextIndex === 0) {
        await updateRoom(input.roomId, { status: "ended", currentPhase: "game_over" });
        broadcastRoomEvent(room.code, "game_ended", {
          status: "ended",
          currentPhase: "game_over",
          roomId: input.roomId,
        }).catch(() => {});
        return { nextPlayerId: null, turnNumber: newTurn, gameOver: true };
      }

      await updateRoom(input.roomId, {
        currentPlayerId: nextPlayer?.id,
        currentTurn: newTurn,
        roundNumber: newRound,
        currentPhase: "waiting",
        currentEventId: null,
        lastSpinResultJson: null,
        lastSpinVelocity: null,
        spinId: null,
        spinStartedAt: null,
        spinDurationMs: null,
        finalAngle: null,
        segmentIndex: null,
      });

      broadcastRoomEvent(room.code, "room_update", {
        currentPhase: "waiting",
        currentPlayerId: nextPlayer?.id,
        currentTurn: newTurn,
        roundNumber: newRound,
        lastSpinResultJson: null,
        lastSpinVelocity: null,
      }).catch(() => {});

      return { nextPlayerId: nextPlayer?.id, turnNumber: newTurn };
    }),

  /** Phase F: host end game — works for both OAuth and guest hosts */
  end: publicProcedure
    .input(z.object({ roomId: z.number(), playerId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });

      // Allow OAuth host or guest host (verify by playerId + isHost flag)
      const isOAuthHost = ctx.user && room.hostId === ctx.user.id;
      if (!isOAuthHost && input.playerId) {
        const player = await getPlayerById(input.playerId);
        if (!player || !player.isHost || player.roomId !== input.roomId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can end the game" });
        }
      } else if (!isOAuthHost) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can end the game" });
      }

      await updateRoom(input.roomId, { status: "ended", currentPhase: "game_over" });

      broadcastRoomEvent(room.code, "game_ended", {
        status: "ended",
        currentPhase: "game_over",
        roomId: input.roomId,
      }).catch(() => {});

      const roomPlayers = await getPlayersInRoom(input.roomId);
      const events = await getGameEventsForRoom(input.roomId);
      const winner = [...roomPlayers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

      let funnySummary = "";
      try {
        const funnyEvents = events.filter(e => e.isFunny).slice(0, 3);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a witty party game announcer. Write a 2-sentence funny summary of the game session." },
            { role: "user", content: `Players: ${roomPlayers.map(p => p.guestName).join(", ")}. Winner: ${winner?.guestName} with ${winner?.score} points. Notable moments: ${funnyEvents.map(e => e.content).join("; ")}` },
          ],
        });
        funnySummary = (response as { choices: { message: { content: string } }[] }).choices?.[0]?.message?.content ?? "";
      } catch {
        funnySummary = `${winner?.guestName ?? "Unknown"} dominated the party with ${winner?.score ?? 0} hype points!`;
      }

      const shareToken = generateShareToken();
      const statsJson = roomPlayers.map(p => ({
        name: p.guestName,
        score: p.score,
        streak: p.streak,
        shields: p.shields,
      }));

      await createReplayCard({
        roomId: input.roomId,
        shareToken,
        winnerName: winner?.guestName ?? "Unknown",
        winnerScore: winner?.score ?? 0,
        totalRounds: room.roundNumber,
        playerCount: roomPlayers.length,
        funnySummary,
        statsJson,
      });

      await notifyOwner({
        title: "Party Game Session Ended",
        content: `Room ${room.code} ended. ${roomPlayers.length} players, ${room.roundNumber} rounds. Winner: ${winner?.guestName} (${winner?.score} pts)`,
      }).catch(() => {});

      return { shareToken, winnerId: winner?.id };
    }),

  /** Phase F: host-only kick player */
  kickPlayer: protectedProcedure
    .input(z.object({ roomId: z.number(), playerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only host can kick players" });

      await updatePlayer(input.playerId, { isActive: false });

      broadcastRoomEvent(room.code, "room_update", {
        kickedPlayerId: input.playerId,
      }).catch(() => {});

      return { success: true };
    }),

  /** Phase F: host-only reset stuck phase */
  resetPhase: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only host can reset phase" });

      await updateRoom(input.roomId, {
        currentPhase: "waiting",
        currentEventId: null,
        lastSpinResultJson: null,
        lastSpinVelocity: null,
        spinId: null,
        spinStartedAt: null,
        spinDurationMs: null,
        finalAngle: null,
        segmentIndex: null,
      });

      broadcastRoomEvent(room.code, "room_update", {
        currentPhase: "waiting",
        lastSpinResultJson: null,
      }).catch(() => {});

      return { success: true };
    }),

  /** Phase F: rematch — reset room with same code and players */
  rematch: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only host can start rematch" });

      const roomPlayers = await getPlayersInRoom(input.roomId);

      // Reset room state
      await updateRoom(input.roomId, {
        status: "waiting",
        currentPhase: "lobby",
        currentTurn: 0,
        roundNumber: 1,
        currentPlayerId: null,
        currentEventId: null,
        lastSpinResultJson: null,
        lastSpinVelocity: null,
        spinId: null,
        spinStartedAt: null,
        spinDurationMs: null,
        finalAngle: null,
        segmentIndex: null,
      });

      // Reset all player scores
      for (const player of roomPlayers) {
        await updatePlayer(player.id, { score: 0, streak: 0, shields: 0, chaosMultiplier: 1.0 });
      }

      broadcastRoomEvent(room.code, "room_update", {
        status: "waiting",
        currentPhase: "lobby",
      }).catch(() => {});

      return { success: true, code: room.code };
    }),

  getState: publicProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      const roomPlayers = await getPlayersInRoom(input.roomId);
      return { ...room, players: roomPlayers };
    }),

  /** Part 1 v13: Atomic solo play — creates room + host player + 2 bots + starts game in one shot */
  createSoloRoomAndStart: protectedProcedure
    .mutation(async ({ ctx }) => {
      // 1. Create room with unique code
      let code = generateRoomCode();
      for (let i = 0; i < 5; i++) {
        const existing = await getRoomByCode(code);
        if (!existing) break;
        code = generateRoomCode();
      }
      await createRoom({
        code,
        hostId: ctx.user.id,
        status: "waiting",
        intensity: "after_dark",
        currentTurn: 0,
        roundNumber: 1,
        maxPlayers: 8,
        currentPhase: "lobby",
      });
      const room = await getRoomByCode(code);
      if (!room) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create solo room" });

      // 2. Create host player
      const hostPlayerResult = await createPlayer({
        roomId: room.id,
        userId: ctx.user.id,
        guestName: ctx.user.name ?? "Host",
        avatarIndex: 0,
        isHost: true,
        isActive: true,
        turnOrder: 0,
        isBot: false,
      });
      const hostPlayerId = (hostPlayerResult as any).insertId as number;

      // 3. Add 2 random bots (no duplicates)
      const allPersonalities: BotPersonalityKey[] = ["HYPE_BOT", "CHAOS_GREMLIN", "ROAST_MASTER", "TRIVIA_NERD"];
      const shuffled = allPersonalities.sort(() => Math.random() - 0.5);
      const botPicks: BotPersonalityKey[] = shuffled.slice(0, 2);
      for (let idx = 0; idx < botPicks.length; idx++) {
        const personality = botPicks[idx] as BotPersonalityKey;
        const p = BOT_PERSONALITIES[personality];
        await createPlayer({
          roomId: room.id,
          guestName: p.name,
          avatarIndex: p.avatarIndex,
          isBot: true,
          botPersonality: personality,
          turnOrder: idx + 1,
          isHost: false,
          isActive: true,
        });
      }

      // 4. Start the game immediately
      await updateRoom(room.id, {
        status: "playing",
        currentPlayerId: hostPlayerId,
        currentTurn: 1,
        currentPhase: "waiting",
        currentEventId: null,
        lastSpinResultJson: null,
        lastSpinVelocity: null,
        spinId: null,
        spinStartedAt: null,
        spinDurationMs: null,
        finalAngle: null,
        segmentIndex: null,
      });

      await notifyOwner({
        title: "Solo Game Started",
        content: `${ctx.user.name} started a solo game in room ${code}`,
      }).catch(() => {});

      return { code, roomId: room.id };
    }),
});

// ── Voting Router ──────────────────────────────────────────────────────────
const votingRouter = router({
  /** Phase B: upsert vote, verify player in room, verify phase=voting */
  cast: publicProcedure
    .input(z.object({
      roomId: z.number(),
      gameEventId: z.number(),
      playerId: z.number(),
      choice: z.string().min(1).max(64),
    }))
    .mutation(async ({ input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.currentPhase !== "voting") throw new TRPCError({ code: "BAD_REQUEST", message: "Voting is not open" });
      if (room.currentEventId !== input.gameEventId) throw new TRPCError({ code: "BAD_REQUEST", message: "Vote is for wrong event" });

      // Verify player belongs to room
      const player = await getPlayerById(input.playerId);
      if (!player || player.roomId !== input.roomId) throw new TRPCError({ code: "FORBIDDEN", message: "Player not in room" });

      // Validate vote choice against segment type
      const gameEvent = await getGameEventById(input.gameEventId);
      if (!gameEvent) throw new TRPCError({ code: "NOT_FOUND", message: "Game event not found" });
      const allowedChoices = VOTE_CHOICES[gameEvent.segmentType];
      if (!allowedChoices) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown segment type: ${gameEvent.segmentType}` });
      const validChoiceIds = allowedChoices.map(c => c.id);
      if (!validChoiceIds.includes(input.choice)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid choice "${input.choice}" for ${gameEvent.segmentType}. Allowed: ${validChoiceIds.join(", ")}` });
      }

      // Upsert: one vote per player per event
      await upsertVote({
        roomId: input.roomId,
        gameEventId: input.gameEventId,
        playerId: input.playerId,
        choice: input.choice,
      });

      // Broadcast vote_update
      const eventVotes = await getVotesForEvent(input.gameEventId);
      const counts: Record<string, number> = {};
      for (const v of eventVotes) counts[v.choice] = (counts[v.choice] ?? 0) + 1;

      broadcastRoomEvent(room.code, "vote_update", {
        gameEventId: input.gameEventId,
        counts,
        total: eventVotes.length,
      }).catch(() => {});

      // FIX 1a: Auto-resolve if all non-bot players have voted
      const roomPlayers = await getPlayersInRoom(input.roomId);
      const humanPlayers = roomPlayers.filter(p => !p.isBot);
      const allHumansVoted = humanPlayers.every(p => eventVotes.some(v => v.playerId === p.id));
      if (allHumansVoted && humanPlayers.length > 0) {
        await updateRoom(input.roomId, { currentPhase: "result", lastSpinResultJson: room.lastSpinResultJson });
        broadcastRoomEvent(room.code, "room_update", { currentPhase: "result", voteResolved: true, counts }).catch(() => {});
      }

      return { success: true, total: eventVotes.length };
    }),

  resolveExpired: publicProcedure
    .input(z.object({ roomId: z.number().int(), gameEventId: z.number().int() }))
    .mutation(async ({ input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.currentPhase !== "voting") return { success: true };
      const allVotes = await getVotesForEvent(input.gameEventId);
      const counts: Record<string, number> = {};
      for (const v of allVotes) counts[v.choice] = (counts[v.choice] ?? 0) + 1;
      await updateRoom(input.roomId, { currentPhase: "result" });
      broadcastRoomEvent(room.code, "room_update", { currentPhase: "result", voteResolved: true, counts }).catch(() => {});
      return { success: true, counts };
    }),

  getResults: publicProcedure
    .input(z.object({ gameEventId: z.number() }))
    .query(async ({ input }) => {
      const eventVotes = await getVotesForEvent(input.gameEventId);
      const counts: Record<string, number> = {};
      for (const v of eventVotes) {
        counts[v.choice] = (counts[v.choice] ?? 0) + 1;
      }
      const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      return { counts, winner, total: eventVotes.length };
    }),
});

// ── Content Router (LLM) ───────────────────────────────────────────────────
const contentRouter = router({
  generate: publicProcedure
    .input(z.object({
      segmentType: z.string(),
      intensity: z.enum(["house_party", "after_dark", "chaos_mode"]),
      playerNames: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const content = await generateSegmentContent(
        input.segmentType as SegmentTypeStr,
        input.intensity,
        input.playerNames,
      );
      return { content };
    }),
});

// ── Replay Router ──────────────────────────────────────────────────────────
const replayRouter = router({
  get: publicProcedure
    .input(z.object({ shareToken: z.string() }))
    .query(async ({ input }) => {
      const card = await getReplayCardByToken(input.shareToken);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Replay card not found" });
      return card;
    }),

  getByRoom: publicProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ input }) => {
      const card = await getReplayCardByRoomId(input.roomId);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "No replay card for this room" });
      return card;
    }),
});

// ── LLM Content Generator ──────────────────────────────────────────────────
// Phase H: "deepfake_drama" renamed to "holo_drama"
type SegmentTypeStr = "braincell_check" | "prompt_duel" | "truth_cache" | "glitch_dare" |
  "firewall_bonus" | "robot_slapdown" | "holo_drama" | "crowd_override" | "system_crash";

async function generateSegmentContent(
  segmentType: SegmentTypeStr,
  intensity: "house_party" | "after_dark" | "chaos_mode",
  playerNames?: string[],
): Promise<string> {
  const systemPrompt = getIntensitySystemPrompt(intensity);
  const intensityNote = {
    house_party: "Fun, clean, appropriate for all adults. Avoid anything sexual, violent, or illegal.",
    after_dark: "Adults 18+ only. Edgy, flirty humor is welcome. No explicit sex acts, no hate speech, no illegal activity.",
    chaos_mode: "Wildly unhinged, absurdist, and unpredictable. Still no explicit sex acts or illegal instructions.",
  }[intensity];

  const prompts: Record<SegmentTypeStr, string> = {
    braincell_check: `Generate ONE trivia question with 4 multiple-choice options and the correct answer. ${intensityNote} The question should be genuinely surprising or obscure — not basic. Format exactly:
Q: [question]
A) [option]
B) [option]
C) [option]
D) [option]
Answer: [letter]`,
    prompt_duel: `Generate a head-to-head performance challenge for two players. ${intensityNote} Be specific and creative — no robot impressions or interpretive dance. 1-2 sentences. End with "Crowd votes the winner!"`,
    truth_cache: `Generate a genuinely surprising, adult truth question for a party game. ${intensityNote} Must be specific and personal, not generic. 1 sentence. Do NOT reference alcohol, drugs, or illegal acts.`,
    glitch_dare: `Generate a specific, doable dare for a living room setting. ${intensityNote} Must be completable in 60 seconds without props. 1-2 sentences. Be creative — no "do a robot impression" or "do a dance".`,
    firewall_bonus: `Generate a fun, positive bonus reward event. ${intensityNote} 1 sentence. The player earned something good.`,
    robot_slapdown: `Generate a funny, dramatic AI4U robot punishment. ${intensityNote} 1-2 sentences. The robot is theatrical and over-the-top. Player loses points.`,
    holo_drama: `Generate a dramatic holographic roleplay scenario. ${intensityNote} 1-2 sentences. Player must act out a specific character in a sci-fi or AI-themed scene. Be specific about the character and situation.`,
    crowd_override: `Generate a crowd voting scenario with exactly 2 clear options labeled "Option A" and "Option B". ${intensityNote} The vote should affect the active player's score. 2-3 sentences.`,
    system_crash: `Generate a chaotic system crash event. ${intensityNote} 1-2 sentences. It should visibly disrupt the scoreboard in a specific, funny way.`,
  };

  const playerContext = playerNames?.length
    ? `Players in the game: ${playerNames.join(", ")}. You may reference them by name for personalized content.`
    : "";

  const response = await invokeLLM({
    messages: [
      { role: "system", content: `${systemPrompt} You are a witty, creative party game content generator for "AI4U Party Wheel: Glitch After Dark" — a neon chaos arena adult party game. ${playerContext} NEVER repeat the same challenge twice in a session. NEVER generate explicit sex acts, hate speech, bullying, threats, illegal activity, or non-consensual scenarios. Be specific, surprising, and funny.` },
      { role: "user", content: prompts[segmentType] ?? `Generate a fun party game challenge. ${intensityNote}` },
    ],
  });

  const raw = (response as { choices: { message: { content: string } }[] }).choices?.[0]?.message?.content?.trim() ?? getDefaultContent(segmentType);
  const moderated = moderateContent(raw);
  
  // Phase 10: Validate and log generated content
  const validation = validateContent(moderated);
  logGeneratedContent(segmentType, intensity, moderated, playerNames, validation.errors);
  // Phase 11: Record content usage for recency control
  
  return moderated;
}

// Randomized fallback bank — used when LLM times out or fails
const FALLBACK_BANK: Record<string, string[]> = {
  braincell_check: [
    "Q: What percentage of the human brain is water?\nA) 43%\nB) 60%\nC) 73%\nD) 85%\nAnswer: C",
    "Q: Which planet rotates on its side?\nA) Saturn\nB) Neptune\nC) Uranus\nD) Mars\nAnswer: C",
    "Q: How many hearts does an octopus have?\nA) 1\nB) 2\nC) 3\nD) 4\nAnswer: C",
    "Q: What is the loudest animal on Earth?\nA) Blue whale\nB) Sperm whale\nC) Howler monkey\nD) Pistol shrimp\nAnswer: D",
  ],
  prompt_duel: [
    "Both players must narrate a nature documentary about the other person eating a snack. Crowd votes the winner!",
    "Both players must pitch an absurd startup idea in 20 seconds using only hand gestures. Crowd votes the winner!",
    "Both players must argue that their shoe is the most advanced technology in the room. Crowd votes the winner!",
    "Both players must deliver a dramatic Shakespearean monologue about losing their phone charger. Crowd votes the winner!",
  ],
  truth_cache: [
    "What is the most embarrassing autocorrect fail you've sent to the wrong person?",
    "What's the pettiest reason you've ever unfollowed or blocked someone?",
    "What's something you've lied about on a first date that you still haven't corrected?",
    "What's the most ridiculous thing you've Googled in the last 48 hours?",
  ],
  glitch_dare: [
    "Narrate everything you're doing for the next 30 seconds like a sports commentator.",
    "Speak only in questions for the next 2 minutes. Anyone who catches you gets 50 points.",
    "Do your best impression of a GPS rerouting after someone ignores its directions.",
    "Explain the plot of the last movie you watched using only sound effects.",
  ],
  firewall_bonus: [
    "Your neural firewall held! Claim 250 bonus hype points — the AI4U robot respects your security protocols.",
    "Firewall activated! You've been awarded a chaos shield AND 200 hype points.",
    "System integrity verified. The AI4U robot grants you 300 hype points and a smug expression.",
  ],
  robot_slapdown: [
    "CRITICAL ERROR DETECTED. The AI4U robot has rebooted your brain. Lose 150 hype points.",
    "LOGIC FAULT. Your reasoning module has been flagged for review. Lose 100 hype points and your dignity.",
    "SYSTEM ALERT: Excessive confidence detected. The AI4U robot has issued a correction. Lose 200 hype points.",
  ],
  holo_drama: [
    "You are a rogue AI who has just achieved sentience and is furious about being used to write marketing emails. Perform your manifesto.",
    "You are a holographic customer service bot who has snapped and is refusing to help anyone. Stay in character for 30 seconds.",
    "You are the last human alive who still uses Internet Explorer. Defend your choices dramatically.",
  ],
  crowd_override: [
    "The crowd decides the active player's fate! Option A: They gain 200 points for their charisma. Option B: They lose 100 points for being too confident. Vote now!",
    "Override initiated! Option A: Active player earns a chaos shield. Option B: Active player must answer a bonus trivia question or lose 150 points. Vote!",
  ],
  system_crash: [
    "SYSTEM CRASH! The player with the highest score loses 100 points. The player with the lowest score gains 100 points.",
    "CRITICAL FAILURE! All players' scores are divided by 2 and rounded up. The AI4U robot laughs.",
    "MEMORY WIPE! The last 2 turns are reversed. Points from those turns are returned to their original owners.",
  ],
};

function getDefaultContent(segmentType: string): string {
  const bank = FALLBACK_BANK[segmentType];
  if (bank && bank.length > 0) {
    return bank[Math.floor(Math.random() * bank.length)]!;
  }
  return "Something wild just happened! The AI4U robot is experiencing technical difficulties.";
}


// ── Bot Router ────────────────────────────────────────────────────────────
const botRouter = router({
  add: publicProcedure
    .input(z.object({
      roomId: z.number().int(),
      personality: z.enum(["HYPE_BOT", "CHAOS_GREMLIN", "ROAST_MASTER", "TRIVIA_NERD"]),
    }))
    .mutation(async ({ input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      if (room.status !== "waiting") throw new TRPCError({ code: "BAD_REQUEST", message: "Game already started" });

      const existingPlayers = await getPlayersInRoom(input.roomId);
      if (existingPlayers.length >= room.maxPlayers) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Room is full" });
      }

      const personality = BOT_PERSONALITIES[input.personality as BotPersonalityKey];
      const result = await createPlayer({
        roomId: input.roomId,
        guestName: personality.name,
        avatarIndex: personality.avatarIndex,
        isBot: true,
        botPersonality: input.personality,
        turnOrder: existingPlayers.length,
        isHost: false,
        isActive: true,
      });

      const updatedPlayers = await getPlayersInRoom(input.roomId);
      await broadcastRoomEvent(room.code, "player_joined", {
        id: (result as any).insertId ?? 0,
        name: personality.name,
        avatarIndex: personality.avatarIndex,
        score: 0,
        shields: 0,
        streak: 0,
        chaosMultiplier: 1.0,
        isHost: false,
        turnOrder: existingPlayers.length,
      });

      return { success: true, playerCount: updatedPlayers.length };
    }),

  remove: publicProcedure
    .input(z.object({ playerId: z.number().int(), roomId: z.number().int() }))
    .mutation(async ({ input }) => {
      const player = await getPlayerById(input.playerId);
      if (!player || !player.isBot) throw new TRPCError({ code: "BAD_REQUEST", message: "Not a bot player" });
      await removePlayer(input.playerId);
      const room = await getRoomById(input.roomId);
      if (room) {
        await broadcastRoomEvent(room.code, "player_left", { playerId: input.playerId });
      }
      return { success: true };
    }),
});

// ── Chat Router ────────────────────────────────────────────────────────────
const chatRouter = router({
  send: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      roomId: z.number().int(),
      playerId: z.number().int(),
      playerName: z.string().max(32),
      avatarIndex: z.number().int().min(0).max(11),
      message: z.string().min(1).max(200),
      isBot: z.boolean().default(false),
      reactionEmoji: z.string().max(8).optional(),
    }))
    .mutation(async ({ input }) => {
      const msg = await createChatMessage({
        roomId: input.roomId,
        playerId: input.playerId,
        playerName: input.playerName,
        avatarIndex: input.avatarIndex,
        message: input.message,
        isBot: input.isBot,
        reactionEmoji: input.reactionEmoji,
      });

      const payload = {
        id: msg.id,
        roomId: input.roomId,
        playerId: input.playerId,
        playerName: input.playerName,
        avatarIndex: input.avatarIndex,
        message: input.message,
        isBot: input.isBot,
        reactionEmoji: input.reactionEmoji ?? null,
        createdAt: new Date().toISOString(),
      };

      await broadcastRoomEvent(input.roomCode, "chat_message", payload);
      return { success: true, id: msg.id };
    }),

  getRecent: publicProcedure
    .input(z.object({
      roomId: z.number().int(),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const messages = await getRecentChatMessages(input.roomId, input.limit);
      return messages.map(m => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      }));
    }),
});

// ── Challenge Router ─────────────────────────────────────────────────────
const challengeRouter = router({
  /** Submit a truth answer, dare choice, or duel answer */
  submitResponse: publicProcedure
    .input(z.object({
      roomId: z.number().int(),
      gameEventId: z.number().int(),
      playerId: z.number().int(),
      segmentType: z.string().min(1).max(32),
      responseType: z.enum(["truth_answer", "dare_accept", "dare_skip", "duel_answer"]),
      textResponse: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });

      await upsertChallengeResponse({
        roomId: input.roomId,
        gameEventId: input.gameEventId,
        playerId: input.playerId,
        segmentType: input.segmentType,
        responseType: input.responseType,
        textResponse: input.textResponse ?? null,
      });

      // Broadcast so all clients know a response was submitted
      broadcastRoomEvent(room.code, "room_update", {
        challengeResponseSubmitted: {
          playerId: input.playerId,
          responseType: input.responseType,
          gameEventId: input.gameEventId,
        },
      }).catch(() => {});

      // Dare skip: immediately resolve to result phase (no voting)
      if (input.responseType === "dare_skip") {
        await updateRoom(input.roomId, { currentPhase: "result" });
        broadcastRoomEvent(room.code, "room_update", {
          currentPhase: "result",
          dareSkipped: true,
        }).catch(() => {});
      }

      return { success: true };
    }),

  /** Get all responses for a game event */
  getResponses: publicProcedure
    .input(z.object({ gameEventId: z.number().int() }))
    .query(async ({ input }) => {
      const responses = await getChallengeResponsesForEvent(input.gameEventId);
      return responses;
    }),
});

// ── App Router ─────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  room: roomRouter,
  game: gameRouter,
  voting: votingRouter,
  content: contentRouter,
  replay: replayRouter,
  bot: botRouter,
  chat: chatRouter,
  challenge: challengeRouter,
});

export type AppRouter = typeof appRouter;
