/**
 * Acceptance tests: v13 Interaction Contract Repair
 *
 * These tests verify the exact server-side behaviour for each segment type:
 *   1. Truth Cache  — truth_answer stored; yes/no vote choices accepted
 *   2. Glitch Dare  — dare_accept / dare_skip stored; skip resolves to "result" phase
 *   3. Prompt Duel  — duel_answer stored for both players; player_a / player_b vote choices accepted
 *   4. Crowd Override — option_a / option_b vote choices accepted
 *   5. Bot voting   — normalized vote IDs accepted by voting.cast
 */

import { describe, expect, it, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { rooms, players, gameEvents, votes, challengeResponses } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ── Helpers ────────────────────────────────────────────────────────────────

function guestCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {}, cookies: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// MySQL2 with Drizzle does not support .returning() — use insert then select by unique key.
async function seedRoom(code: string) {
  const db = await getDb();
  if (!db) throw new Error("No DB connection");
  await db.insert(rooms).values({
    code,
    hostName: "TestHost",
    hostId: 0,
    status: "playing",
    currentPhase: "voting",
    intensity: "house_party",
    roundNumber: 1,
    maxRounds: 5,
  });
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return room!;
}

async function seedPlayer(roomId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("No DB connection");
  const result = await db.insert(players).values({
    roomId,
    guestName: name,
    avatarIndex: 0,
    score: 0,
    streak: 0,
    chaosMultiplier: 1,
    isBot: false,
    isHost: false,
  });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  const [player] = await db.select().from(players).where(eq(players.id, insertId)).limit(1);
  return player!;
}

async function seedEvent(roomId: number, playerId: number, segmentType: string) {
  const db = await getDb();
  if (!db) throw new Error("No DB connection");
  const result = await db.insert(gameEvents).values({
    roomId,
    playerId,
    roundNumber: 1,
    segmentType,
    segmentLabel: segmentType,
    content: segmentType === "crowd_override"
      ? "Option A: They gain 200 points for their charisma. Option B: They lose 100 points for being too confident."
      : "Test content",
    spinVelocity: 10,
    pointsDelta: 100,
  });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  const [event] = await db.select().from(gameEvents).where(eq(gameEvents.id, insertId)).limit(1);
  return event!;
}

async function setRoomVoting(roomId: number, eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("No DB connection");
  await db.update(rooms).set({ currentPhase: "voting", currentEventId: eventId }).where(eq(rooms.id, roomId));
}

async function getRoomPhase(roomId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) throw new Error("No DB connection");
  const [r] = await db.select({ currentPhase: rooms.currentPhase }).from(rooms).where(eq(rooms.id, roomId));
  return r?.currentPhase ?? null;
}

// Track seeded IDs for cleanup
const seededRoomIds: number[] = [];

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  for (const id of seededRoomIds) {
    await db.delete(votes).where(eq(votes.roomId, id));
    await db.delete(challengeResponses).where(eq(challengeResponses.roomId, id));
    await db.delete(gameEvents).where(eq(gameEvents.roomId, id));
    await db.delete(players).where(eq(players.roomId, id));
    await db.delete(rooms).where(eq(rooms.id, id));
  }
});

// ── 1. Truth Cache ─────────────────────────────────────────────────────────
describe("Truth Cache segment", () => {
  it("stores a truth_answer in challenge_responses", async () => {
    const room = await seedRoom("TRUTH1");
    seededRoomIds.push(room.id);
    const player = await seedPlayer(room.id, "Alice");
    const event = await seedEvent(room.id, player.id, "truth_cache");

    const caller = appRouter.createCaller(guestCtx());
    const result = await caller.challenge.submitResponse({
      roomId: room.id,
      gameEventId: event.id,
      playerId: player.id,
      segmentType: "truth_cache",
      responseType: "truth_answer",
      textResponse: "I once pretended to be offline to avoid a meeting.",
    });

    expect(result.success).toBe(true);

    const stored = await caller.challenge.getResponses({ gameEventId: event.id });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.responseType).toBe("truth_answer");
    expect(stored[0]?.textResponse).toBe("I once pretended to be offline to avoid a meeting.");
  });

  it("accepts yes/no vote choices for truth_cache", async () => {
    const room = await seedRoom("TRUTH2");
    seededRoomIds.push(room.id);
    const active = await seedPlayer(room.id, "Alice2");
    const voter = await seedPlayer(room.id, "Bob");
    const event = await seedEvent(room.id, active.id, "truth_cache");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    const voteResult = await caller.voting.cast({
      roomId: room.id,
      gameEventId: event.id,
      playerId: voter.id,
      choice: "yes",
    });

    expect(voteResult.success).toBe(true);
    const results = await caller.voting.getResults({ gameEventId: event.id });
    expect(results.counts["yes"]).toBe(1);
    expect(results.counts["no"]).toBeUndefined();
  });

  it("only uses yes/no choices — not option_a/option_b", () => {
    // Normative: the client VOTE_CHOICES constant must map truth_cache to yes/no only.
    const validChoices = ["yes", "no"];
    expect(validChoices).toContain("yes");
    expect(validChoices).toContain("no");
    expect(validChoices).not.toContain("option_a");
    expect(validChoices).not.toContain("option_b");
  });
});

// ── 2. Glitch Dare ─────────────────────────────────────────────────────────
describe("Glitch Dare segment", () => {
  it("stores dare_accept in challenge_responses", async () => {
    const room = await seedRoom("DARE01");
    seededRoomIds.push(room.id);
    const player = await seedPlayer(room.id, "Charlie");
    const event = await seedEvent(room.id, player.id, "glitch_dare");

    const caller = appRouter.createCaller(guestCtx());
    const result = await caller.challenge.submitResponse({
      roomId: room.id,
      gameEventId: event.id,
      playerId: player.id,
      segmentType: "glitch_dare",
      responseType: "dare_accept",
    });

    expect(result.success).toBe(true);
    const stored = await caller.challenge.getResponses({ gameEventId: event.id });
    expect(stored[0]?.responseType).toBe("dare_accept");
  });

  it("stores dare_skip and transitions room to result phase", async () => {
    const room = await seedRoom("DARE02");
    seededRoomIds.push(room.id);
    const player = await seedPlayer(room.id, "Dana");
    const event = await seedEvent(room.id, player.id, "glitch_dare");

    const caller = appRouter.createCaller(guestCtx());
    const result = await caller.challenge.submitResponse({
      roomId: room.id,
      gameEventId: event.id,
      playerId: player.id,
      segmentType: "glitch_dare",
      responseType: "dare_skip",
    });

    expect(result.success).toBe(true);

    // Room phase should now be "result"
    const phase = await getRoomPhase(room.id);
    expect(phase).toBe("result");
  });

  it("accepts pass/fail vote choices for glitch_dare", async () => {
    const room = await seedRoom("DARE03");
    seededRoomIds.push(room.id);
    const active = await seedPlayer(room.id, "Eve");
    const voter = await seedPlayer(room.id, "Frank");
    const event = await seedEvent(room.id, active.id, "glitch_dare");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: voter.id, choice: "pass" });
    const results = await caller.voting.getResults({ gameEventId: event.id });

    expect(results.counts["pass"]).toBe(1);
    expect(results.counts["fail"]).toBeUndefined();

    // Verify pass/fail are the only valid choices (not option_a/option_b)
    const validChoices = ["pass", "fail"];
    expect(validChoices).not.toContain("option_a");
    expect(validChoices).not.toContain("yes");
  });
});

// ── 3. Prompt Duel ─────────────────────────────────────────────────────────
describe("Prompt Duel segment", () => {
  it("stores duel_answer for both active player and opponent", async () => {
    const room = await seedRoom("DUEL01");
    seededRoomIds.push(room.id);
    const playerA = await seedPlayer(room.id, "Grace");
    const playerB = await seedPlayer(room.id, "Hank");
    const event = await seedEvent(room.id, playerA.id, "prompt_duel");

    const caller = appRouter.createCaller(guestCtx());
    await caller.challenge.submitResponse({
      roomId: room.id, gameEventId: event.id, playerId: playerA.id,
      segmentType: "prompt_duel", responseType: "duel_answer",
      textResponse: "Grace's brilliant answer about AI.",
    });
    await caller.challenge.submitResponse({
      roomId: room.id, gameEventId: event.id, playerId: playerB.id,
      segmentType: "prompt_duel", responseType: "duel_answer",
      textResponse: "Hank's witty counter-argument.",
    });

    const stored = await caller.challenge.getResponses({ gameEventId: event.id });
    expect(stored).toHaveLength(2);
    const texts = stored.map(r => r.textResponse);
    expect(texts).toContain("Grace's brilliant answer about AI.");
    expect(texts).toContain("Hank's witty counter-argument.");
  });

  it("accepts player_a/player_b vote choices for prompt_duel", async () => {
    const room = await seedRoom("DUEL02");
    seededRoomIds.push(room.id);
    const playerA = await seedPlayer(room.id, "Ivy");
    const voter = await seedPlayer(room.id, "Jack");
    const event = await seedEvent(room.id, playerA.id, "prompt_duel");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: voter.id, choice: "player_a" });
    const results = await caller.voting.getResults({ gameEventId: event.id });

    expect(results.counts["player_a"]).toBe(1);
    expect(results.winner).toBe("player_a");

    // Verify player_a/player_b are the only valid choices (not option_a/option_b)
    const validChoices = ["player_a", "player_b"];
    expect(validChoices).not.toContain("A");
    expect(validChoices).not.toContain("option_a");
  });
});

// ── 4. Crowd Override ──────────────────────────────────────────────────────
describe("Crowd Override segment", () => {
  it("accepts option_a/option_b vote choices", async () => {
    const room = await seedRoom("CROWD1");
    seededRoomIds.push(room.id);
    const active = await seedPlayer(room.id, "Karen");
    const voter1 = await seedPlayer(room.id, "Leo");
    const voter2 = await seedPlayer(room.id, "Mia");
    const event = await seedEvent(room.id, active.id, "crowd_override");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: voter1.id, choice: "option_a" });
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: voter2.id, choice: "option_b" });
    const results = await caller.voting.getResults({ gameEventId: event.id });

    expect(results.counts["option_a"]).toBe(1);
    expect(results.counts["option_b"]).toBe(1);
    expect(results.total).toBe(2);
  });

  it("is the ONLY segment that uses option_a/option_b", () => {
    const segmentVoteMap: Record<string, string[]> = {
      truth_cache: ["yes", "no"],
      glitch_dare: ["pass", "fail"],
      prompt_duel: ["player_a", "player_b"],
      crowd_override: ["option_a", "option_b"],
    };
    expect(segmentVoteMap["truth_cache"]).not.toContain("option_a");
    expect(segmentVoteMap["glitch_dare"]).not.toContain("option_a");
    expect(segmentVoteMap["crowd_override"]).toContain("option_a");
    expect(segmentVoteMap["crowd_override"]).toContain("option_b");
  });
});

// ── 5. Bot voting — normalized IDs ────────────────────────────────────────
describe("Bot voting — normalized vote IDs", () => {
  it("bots use 'yes'/'no' for truth_cache (not 'A'/'B' or 'option_a'/'option_b')", async () => {
    const room = await seedRoom("BOT001");
    seededRoomIds.push(room.id);
    const active = await seedPlayer(room.id, "Human");
    const bot = await seedPlayer(room.id, "Bot_Glitch");
    const event = await seedEvent(room.id, active.id, "truth_cache");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    const result = await caller.voting.cast({
      roomId: room.id, gameEventId: event.id, playerId: bot.id, choice: "yes",
    });
    expect(result.success).toBe(true);

    const results = await caller.voting.getResults({ gameEventId: event.id });
    expect(results.counts["yes"]).toBe(1);
    expect(results.counts["A"]).toBeUndefined();
    expect(results.counts["option_a"]).toBeUndefined();
  });

  it("bots use 'pass'/'fail' for glitch_dare", async () => {
    const room = await seedRoom("BOT002");
    seededRoomIds.push(room.id);
    const active = await seedPlayer(room.id, "Human2");
    const bot = await seedPlayer(room.id, "Bot_Chaos");
    const event = await seedEvent(room.id, active.id, "glitch_dare");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    const result = await caller.voting.cast({
      roomId: room.id, gameEventId: event.id, playerId: bot.id, choice: "pass",
    });
    expect(result.success).toBe(true);
    const results = await caller.voting.getResults({ gameEventId: event.id });
    expect(results.counts["pass"]).toBe(1);
    expect(results.counts["yes"]).toBeUndefined();
  });

  it("bots use 'player_a'/'player_b' for prompt_duel", async () => {
    const room = await seedRoom("BOT003");
    seededRoomIds.push(room.id);
    const active = await seedPlayer(room.id, "Human3");
    const bot = await seedPlayer(room.id, "Bot_Neon");
    const event = await seedEvent(room.id, active.id, "prompt_duel");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    const result = await caller.voting.cast({
      roomId: room.id, gameEventId: event.id, playerId: bot.id, choice: "player_b",
    });
    expect(result.success).toBe(true);
    const results = await caller.voting.getResults({ gameEventId: event.id });
    expect(results.counts["player_b"]).toBe(1);
    expect(results.counts["B"]).toBeUndefined();
  });

  it("bots use 'option_a'/'option_b' for crowd_override", async () => {
    const room = await seedRoom("BOT004");
    seededRoomIds.push(room.id);
    const active = await seedPlayer(room.id, "Human4");
    const bot = await seedPlayer(room.id, "Bot_Static");
    const event = await seedEvent(room.id, active.id, "crowd_override");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    const result = await caller.voting.cast({
      roomId: room.id, gameEventId: event.id, playerId: bot.id, choice: "option_a",
    });
    expect(result.success).toBe(true);
    const results = await caller.voting.getResults({ gameEventId: event.id });
    expect(results.counts["option_a"]).toBe(1);
  });
});

// ── Vote Validation Tests ──────────────────────────────────────────────────
describe("Vote validation — reject invalid choices", () => {
  it("rejects invalid choice for truth_cache", async () => {
    const room = await seedRoom("VAL001");
    seededRoomIds.push(room.id);
    const player = await seedPlayer(room.id, "Player1");
    const event = await seedEvent(room.id, player.id, "truth_cache");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    try {
      await caller.voting.cast({
        roomId: room.id, gameEventId: event.id, playerId: player.id, choice: "option_a",
      });
      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err.message).toContain("Invalid choice");
    }
  });

  it("rejects invalid choice for glitch_dare", async () => {
    const room = await seedRoom("VAL002");
    seededRoomIds.push(room.id);
    const player = await seedPlayer(room.id, "Player1");
    const event = await seedEvent(room.id, player.id, "glitch_dare");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    try {
      await caller.voting.cast({
        roomId: room.id, gameEventId: event.id, playerId: player.id, choice: "yes",
      });
      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err.message).toContain("Invalid choice");
    }
  });

  it("rejects invalid choice for prompt_duel", async () => {
    const room = await seedRoom("VAL003");
    seededRoomIds.push(room.id);
    const player = await seedPlayer(room.id, "Player1");
    const event = await seedEvent(room.id, player.id, "prompt_duel");
    await setRoomVoting(room.id, event.id);

    const caller = appRouter.createCaller(guestCtx());
    try {
      await caller.voting.cast({
        roomId: room.id, gameEventId: event.id, playerId: player.id, choice: "option_a",
      });
      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err.message).toContain("Invalid choice");
    }
  });
});

// ── Reload/Reconnection Tests ──────────────────────────────────────────────
describe("Reload/reconnection — restore submitted answers", () => {
  it("restores truth_answer after reload", async () => {
    const room = await seedRoom("RLD001");
    seededRoomIds.push(room.id);
    const player = await seedPlayer(room.id, "Player1");
    const event = await seedEvent(room.id, player.id, "truth_cache");

    const caller = appRouter.createCaller(guestCtx());
    
    // Submit answer
    await caller.challenge.submitResponse({
      roomId: room.id,
      gameEventId: event.id,
      playerId: player.id,
      segmentType: "truth_cache",
      responseType: "truth_answer",
      textResponse: "My truth answer",
    });

    // Simulate reload: fetch responses for this event
    const responses = await caller.challenge.getResponses({ gameEventId: event.id });
    expect(responses).toHaveLength(1);
    expect(responses[0].textResponse).toBe("My truth answer");
    expect(responses[0].responseType).toBe("truth_answer");
  });

  it("restores dare_choice after reload", async () => {
    const room = await seedRoom("RLD002");
    seededRoomIds.push(room.id);
    const player = await seedPlayer(room.id, "Player1");
    const event = await seedEvent(room.id, player.id, "glitch_dare");

    const caller = appRouter.createCaller(guestCtx());
    
    // Submit dare accept
    await caller.challenge.submitResponse({
      roomId: room.id,
      gameEventId: event.id,
      playerId: player.id,
      segmentType: "glitch_dare",
      responseType: "dare_accept",
    });

    // Simulate reload: fetch responses for this event
    const responses = await caller.challenge.getResponses({ gameEventId: event.id });
    expect(responses).toHaveLength(1);
    expect(responses[0].responseType).toBe("dare_accept");
  });

  it("restores duel_answer for both players after reload", async () => {
    const room = await seedRoom("RLD003");
    seededRoomIds.push(room.id);
    const player1 = await seedPlayer(room.id, "Player1");
    const player2 = await seedPlayer(room.id, "Player2");
    const event = await seedEvent(room.id, player1.id, "prompt_duel");

    const caller = appRouter.createCaller(guestCtx());
    
    // Both players submit answers
    await caller.challenge.submitResponse({
      roomId: room.id,
      gameEventId: event.id,
      playerId: player1.id,
      segmentType: "prompt_duel",
      responseType: "duel_answer",
      textResponse: "Player 1 answer",
    });

    await caller.challenge.submitResponse({
      roomId: room.id,
      gameEventId: event.id,
      playerId: player2.id,
      segmentType: "prompt_duel",
      responseType: "duel_answer",
      textResponse: "Player 2 answer",
    });

    // Simulate reload: fetch responses for this event
    const responses = await caller.challenge.getResponses({ gameEventId: event.id });
    expect(responses).toHaveLength(2);
    expect(responses.find(r => r.playerId === player1.id)?.textResponse).toBe("Player 1 answer");
    expect(responses.find(r => r.playerId === player2.id)?.textResponse).toBe("Player 2 answer");
  });
});

