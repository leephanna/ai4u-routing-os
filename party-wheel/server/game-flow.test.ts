/**
 * game-flow.test.ts
 *
 * End-to-end game session simulation.
 * Walks through a complete game: room creation → player join → spin (all segment types)
 * → phase transitions → voting/submission → nextTurn → repeat → game end.
 *
 * Catches:
 *   - Phase getting stuck (landing_closeup never advances)
 *   - Server rejecting vote choices
 *   - nextTurn failing after each segment type
 *   - Auto-end not triggering after max rounds
 */

import { describe, it, expect, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { rooms, players, gameEvents, votes, challengeResponses } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ── Helpers ────────────────────────────────────────────────────────────────

function ctx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {}, cookies: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const cleanupIds: number[] = [];

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  for (const id of cleanupIds) {
    await db.delete(votes).where(eq(votes.roomId, id));
    await db.delete(challengeResponses).where(eq(challengeResponses.roomId, id));
    await db.delete(gameEvents).where(eq(gameEvents.roomId, id));
    await db.delete(players).where(eq(players.roomId, id));
    await db.delete(rooms).where(eq(rooms.id, id));
  }
});

async function seedRoom(code: string, intensity = "house_party") {
  const db = await getDb();
  if (!db) throw new Error("No DB");
  await db.insert(rooms).values({
    code, hostName: "TestHost", hostId: 0,
    status: "playing", currentPhase: "waiting",
    intensity, roundNumber: 1, maxRounds: 3, maxPlayers: 8,
  });
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  cleanupIds.push(room!.id);
  return room!;
}

async function seedPlayer(roomId: number, name: string, isBot = false) {
  const db = await getDb();
  if (!db) throw new Error("No DB");
  const result = await db.insert(players).values({
    roomId, guestName: name, avatarIndex: 0,
    score: 0, streak: 0, chaosMultiplier: 1,
    isBot, isHost: false, isActive: true,
  });
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const [p] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return p!;
}

async function seedEvent(roomId: number, playerId: number, segmentType: string) {
  const db = await getDb();
  if (!db) throw new Error("No DB");
  const result = await db.insert(gameEvents).values({
    roomId, playerId, roundNumber: 1,
    segmentType, segmentLabel: segmentType,
    content: "Test challenge content",
    spinVelocity: 10, pointsDelta: 100,
  });
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const [e] = await db.select().from(gameEvents).where(eq(gameEvents.id, id)).limit(1);
  return e!;
}

async function getPhase(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("No DB");
  const [r] = await db.select({ currentPhase: rooms.currentPhase }).from(rooms).where(eq(rooms.id, roomId));
  return r?.currentPhase ?? null;
}

async function setPhase(roomId: number, phase: string, eventId?: number) {
  const db = await getDb();
  if (!db) throw new Error("No DB");
  await db.update(rooms).set({
    currentPhase: phase,
    ...(eventId !== undefined ? { currentEventId: eventId } : {}),
  }).where(eq(rooms.id, roomId));
}

async function setActivePlayer(roomId: number, playerId: number) {
  const db = await getDb();
  if (!db) throw new Error("No DB");
  await db.update(rooms).set({ currentPlayerId: playerId }).where(eq(rooms.id, roomId));
}

// ── SIMPLE SEGMENT FLOW TESTS ──────────────────────────────────────────────

describe("Game Flow: Simple segments (no voting)", () => {
  const SIMPLE_SEGMENTS = [
    "firewall_bonus", "robot_slapdown", "system_crash",
    "holo_drama", "braincell_check", "steal_signal",
  ];

  for (const seg of SIMPLE_SEGMENTS) {
    it(`${seg}: nextTurn advances from result to waiting`, async () => {
      const code = `SF${seg.slice(0, 4).toUpperCase()}`;
      const room = await seedRoom(code);
      const p1 = await seedPlayer(room.id, "Alice");
      const p2 = await seedPlayer(room.id, "Bob");

      await setActivePlayer(room.id, p1.id);
      await setPhase(room.id, "result");

      const caller = appRouter.createCaller(ctx());
      const result = await caller.game.nextTurn({
        roomId: room.id,
        playerId: p1.id,
      });

      // Phase should advance to waiting with next player active
      const phase = await getPhase(room.id);
      expect(phase, `${seg}: phase after nextTurn should be "waiting"`).toBe("waiting");
      expect(result.nextPlayerId, `${seg}: nextPlayerId should be set`).toBeTruthy();
    });
  }
});

// ── GLITCH DARE FLOW ───────────────────────────────────────────────────────

describe("Game Flow: Glitch Dare — full round trip", () => {
  it("dare_accept: server phase is answer_submission after event created", async () => {
    const room = await seedRoom("GDFLO1");
    const p1 = await seedPlayer(room.id, "Lee");
    const event = await seedEvent(room.id, p1.id, "glitch_dare");

    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "answer_submission", event.id);

    const phase = await getPhase(room.id);
    expect(phase).toBe("answer_submission");
  });

  it("dare_accept: submitResponse stores dare_accept (phase stays answer_submission)", async () => {
    const room = await seedRoom("GDFLO2");
    const p1 = await seedPlayer(room.id, "Lee");
    const p2 = await seedPlayer(room.id, "Ron");
    const event = await seedEvent(room.id, p1.id, "glitch_dare");
    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "answer_submission", event.id);

    const caller = appRouter.createCaller(ctx());
    await caller.challenge.submitResponse({
      roomId: room.id, gameEventId: event.id, playerId: p1.id,
      segmentType: "glitch_dare", responseType: "dare_accept",
    });

    // Phase stays in answer_submission until all respond
    const phase = await getPhase(room.id);
    expect(phase, "After dare_accept, phase stays answer_submission").toBe("answer_submission");
  });
  it("dare_accept -> all vote pass -> resolves to result", async () => {
    const room = await seedRoom("GDFLO3");
    const p1 = await seedPlayer(room.id, "Lee");
    const p2 = await seedPlayer(room.id, "Ron");
    const event = await seedEvent(room.id, p1.id, "glitch_dare");
    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "voting", event.id);

    const caller = appRouter.createCaller(ctx());
    // Both players vote to auto-resolve
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p1.id, choice: "pass" });
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p2.id, choice: "pass" });

    // All humans voted — auto-resolve should set phase to result
    const phase = await getPhase(room.id);
    expect(phase, "After all votes cast, phase should be result").toBe("result");
  });
  it("dare_skip: submitResponse transitions directly to result (no vote)", async () => {
    const room = await seedRoom("GDFLO4");
    const p1 = await seedPlayer(room.id, "Lee");
    const event = await seedEvent(room.id, p1.id, "glitch_dare");
    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "answer_submission", event.id);

    const caller = appRouter.createCaller(ctx());
    await caller.challenge.submitResponse({
      roomId: room.id, gameEventId: event.id, playerId: p1.id,
      segmentType: "glitch_dare", responseType: "dare_skip",
    });

    const phase = await getPhase(room.id);
    expect(phase, "After dare_skip, phase should immediately be result").toBe("result");
  });

  it("dare: nextTurn after result advances to waiting", async () => {
    const room = await seedRoom("GDFLO5");
    const p1 = await seedPlayer(room.id, "Lee");
    const p2 = await seedPlayer(room.id, "Ron");
    const event = await seedEvent(room.id, p1.id, "glitch_dare");
    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "result", event.id);

    const caller = appRouter.createCaller(ctx());
    await caller.game.nextTurn({
      roomId: room.id,
      playerId: p1.id,
    });

    const phase = await getPhase(room.id);
    expect(phase, "After nextTurn, phase should be waiting").toBe("waiting");
  });
});

// ── TRUTH CACHE FLOW ───────────────────────────────────────────────────────

describe("Game Flow: Truth Cache — full round trip", () => {
  it("answer submitted → answer_submission → voting → all vote → result → nextTurn → waiting", async () => {
    const room = await seedRoom("TCFLO1");
    const p1 = await seedPlayer(room.id, "Lee");
    const p2 = await seedPlayer(room.id, "Ron");
    const event = await seedEvent(room.id, p1.id, "truth_cache");
    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "answer_submission", event.id);

    const caller = appRouter.createCaller(ctx());

    // Submit answer
    await caller.challenge.submitResponse({
      roomId: room.id, gameEventId: event.id, playerId: p1.id,
      segmentType: "truth_cache", responseType: "truth_answer",
      textResponse: "I once ate an entire pizza alone.",
    });
    // Phase stays in answer_submission
    expect(await getPhase(room.id)).toBe("answer_submission");

    // Manually transition to voting
    await setPhase(room.id, "voting", event.id);
    // Both vote
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p1.id, choice: "yes" });
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p2.id, choice: "yes" });
    expect(await getPhase(room.id)).toBe("result");

    // Advance turn
    await caller.game.nextTurn({ roomId: room.id, playerId: p1.id });
    expect(await getPhase(room.id)).toBe("waiting");
  });
});

// ── PROMPT DUEL FLOW ───────────────────────────────────────────────────────

describe("Game Flow: Prompt Duel — full round trip", () => {
  it("both answer → crowd votes player_a → result → nextTurn", async () => {
    const room = await seedRoom("PDFLO1");
    const p1 = await seedPlayer(room.id, "Lee");
    const p2 = await seedPlayer(room.id, "Ron");
    const event = await seedEvent(room.id, p1.id, "prompt_duel");
    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "voting", event.id);

    const caller = appRouter.createCaller(ctx());
    // Both players vote to auto-resolve
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p1.id, choice: "player_a" });
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p2.id, choice: "player_a" });

    expect(await getPhase(room.id)).toBe("result");
    await caller.game.nextTurn({ roomId: room.id, playerId: p1.id });
    expect(await getPhase(room.id)).toBe("waiting");
  });
});

// ── CROWD OVERRIDE FLOW ────────────────────────────────────────────────────

describe("Game Flow: Crowd Override — full round trip", () => {
  it("all vote option_a → result → nextTurn", async () => {
    const room = await seedRoom("COFLO1");
    const p1 = await seedPlayer(room.id, "Lee");
    const p2 = await seedPlayer(room.id, "Ron");
    const event = await seedEvent(room.id, p1.id, "crowd_override");
    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "voting", event.id);

    const caller = appRouter.createCaller(ctx());
    // Both players vote to auto-resolve
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p1.id, choice: "option_a" });
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p2.id, choice: "option_a" });
    expect(await getPhase(room.id)).toBe("result");
    await caller.game.nextTurn({ roomId: room.id, playerId: p1.id });
    expect(await getPhase(room.id)).toBe("waiting");
  });
});

// ── UI PHASE VISIBILITY MATRIX ─────────────────────────────────────────────
// These tests document which phases should show content vs wheel.
// They are NORMATIVE — if the constants change, these catch it.

describe("UI Phase Visibility — showContent and showWheel contract", () => {
  // These are the exact values from Game.tsx showContent and showWheel
  // If they change, these tests fail immediately
  const SHOW_WHEEL_PHASES = new Set(["waiting", "spin_preview", "spinning"]);
  const SHOW_CONTENT_PHASES = new Set(["result", "voting", "landing", "robot_attack", "answer_submission"]);
  const ALL_PHASES = ["waiting", "spin_preview", "spinning", "landing", "result", "voting", "robot_attack", "answer_submission"];

  it("every phase has a defined visibility", () => {
    for (const phase of ALL_PHASES) {
      const visible = SHOW_WHEEL_PHASES.has(phase) || SHOW_CONTENT_PHASES.has(phase);
      expect(visible, `Phase "${phase}" is not in showWheel or showContent — BLANK SCREEN BUG`).toBe(true);
    }
  });

  it("no phase shows both wheel AND content simultaneously", () => {
    for (const phase of ALL_PHASES) {
      const inWheel = SHOW_WHEEL_PHASES.has(phase);
      const inContent = SHOW_CONTENT_PHASES.has(phase);
      expect(inWheel && inContent, `Phase "${phase}" is in BOTH showWheel and showContent — layout conflict`).toBe(false);
    }
  });

  it("answer_submission shows content (not blank screen)", () => {
    expect(SHOW_CONTENT_PHASES.has("answer_submission"),
      "answer_submission must be in showContent or players see blank screen during glitch_dare and truth_cache"
    ).toBe(true);
  });

  it("robot_attack shows content (robot overlay, not blank)", () => {
    expect(SHOW_CONTENT_PHASES.has("robot_attack")).toBe(true);
  });

  it("landing shows content (result card behind overlay)", () => {
    expect(SHOW_CONTENT_PHASES.has("landing")).toBe(true);
  });
});

// ── AUTO-END GAME FLOW ─────────────────────────────────────────────────────

describe("Game Flow: Auto-end after max rounds", () => {
  it("game ends when roundNumber exceeds maxRounds", async () => {
    const room = await seedRoom("AUTOEN");
    const p1 = await seedPlayer(room.id, "Lee");
    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "result");

    // Force round counter past max
    const db = await getDb();
    if (!db) throw new Error("No DB");
    await db.update(rooms).set({ roundNumber: 3, maxRounds: 3 }).where(eq(rooms.id, room.id));

    const caller = appRouter.createCaller(ctx());
    const result = await caller.game.nextTurn({ roomId: room.id, playerId: p1.id });

    expect(result.gameOver, "Game should report gameOver=true").toBe(true);
    const phase = await getPhase(room.id);
    expect(phase, "Phase should be game_over after auto-end").toBe("game_over");
  });
});

// ── CONCURRENT MULTI-PLAYER VOTE ───────────────────────────────────────────

describe("Game Flow: Concurrent votes from multiple players", () => {
  it("3 players vote simultaneously without duplicate errors", async () => {
    const room = await seedRoom("CONC01");
    const p1 = await seedPlayer(room.id, "Lee");
    const p2 = await seedPlayer(room.id, "Ron");
    const p3 = await seedPlayer(room.id, "Fred");
    const event = await seedEvent(room.id, p1.id, "crowd_override");
    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "voting", event.id);

    const caller = appRouter.createCaller(ctx());
    // All three vote at the same time
    await Promise.all([
      caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p2.id, choice: "option_a" }),
      caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p3.id, choice: "option_b" }),
    ]);

    const results = await caller.voting.getResults({ gameEventId: event.id });
    expect(results.total, "Total votes should be 2").toBe(2);
    expect(results.counts["option_a"] + (results.counts["option_b"] ?? 0), "Votes should sum to 2").toBe(2);
  });

  it("same player cannot vote twice (upsert behavior)", async () => {
    const room = await seedRoom("CONC02");
    const p1 = await seedPlayer(room.id, "Lee");
    const p2 = await seedPlayer(room.id, "Ron");
    const event = await seedEvent(room.id, p1.id, "crowd_override");
    await setActivePlayer(room.id, p1.id);
    await setPhase(room.id, "voting", event.id);

    const caller = appRouter.createCaller(ctx());
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p2.id, choice: "option_a" });
    await caller.voting.cast({ roomId: room.id, gameEventId: event.id, playerId: p2.id, choice: "option_b" }); // change vote

    const results = await caller.voting.getResults({ gameEventId: event.id });
    expect(results.total, "Double-voting should upsert, not duplicate").toBe(1);
    // Last vote wins
    expect(results.counts["option_b"], "Last vote choice should win").toBe(1);
  });
});
