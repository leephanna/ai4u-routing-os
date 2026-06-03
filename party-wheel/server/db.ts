import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users, rooms, players, gameEvents, votes, replayCards, chatMessages, challengeResponses,
  InsertUser, InsertRoom, InsertPlayer, InsertGameEvent, InsertVote, InsertReplayCard, InsertChatMessage, InsertChallengeResponse,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Users ──────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ── Rooms ──────────────────────────────────────────────────────────────────
export async function createRoom(data: InsertRoom) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(rooms).values(data);
  return result[0];
}

export async function getRoomByCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return result[0];
}

export async function getRoomById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  return result[0];
}

export async function updateRoom(id: number, data: Partial<InsertRoom>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(rooms).set(data).where(eq(rooms.id, id));
}

// ── Players ────────────────────────────────────────────────────────────────
export async function createPlayer(data: InsertPlayer) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(players).values(data);
  return result[0];
}

export async function getPlayersInRoom(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.select().from(players)
    .where(and(eq(players.roomId, roomId), eq(players.isActive, true)))
    .orderBy(players.turnOrder);
}

export async function getPlayerById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return result[0];
}

export async function updatePlayer(id: number, data: Partial<InsertPlayer>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(players).set(data).where(eq(players.id, id));
}

// ── Game Events ────────────────────────────────────────────────────────────
export async function createGameEvent(data: InsertGameEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(gameEvents).values(data);
  // Return insertId so callers can reference the new event
  return { id: (result as any)[0]?.insertId ?? (result as any).insertId ?? 0 };
}

export async function getGameEventById(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.select().from(gameEvents)
    .where(eq(gameEvents.id, eventId))
    .limit(1)
    .then(rows => rows[0] ?? null);
}

export async function getGameEventsForRoom(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.select().from(gameEvents)
    .where(eq(gameEvents.roomId, roomId))
    .orderBy(desc(gameEvents.createdAt));
}

/// ── Votes ────────────────────────────────────────────────────────────────
export async function castVote(data: InsertVote) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(votes).values(data);
}

/** Upsert: one vote per player per event (prevents duplicate votes) */
export async function upsertVote(data: InsertVote) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(votes).values(data).onDuplicateKeyUpdate({ set: { choice: data.choice } });
}

export async function getPlayerByGuestSession(roomId: number, guestSessionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(players)
    .where(and(eq(players.roomId, roomId), eq(players.guestSessionId, guestSessionId)))
    .limit(1);
  return result[0];
}

export async function getVotesForEvent(gameEventId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.select().from(votes).where(eq(votes.gameEventId, gameEventId));
}

// ── Chat Messages ─────────────────────────────────────────────────────────
export async function createChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(chatMessages).values(data);
  return { id: (result as any)[0]?.insertId ?? (result as any).insertId ?? 0 };
}

export async function getRecentChatMessages(roomId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const rows = await db.select().from(chatMessages)
    .where(eq(chatMessages.roomId, roomId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.reverse(); // chronological order
}

export async function removePlayer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(players).set({ isActive: false }).where(eq(players.id, id));
}

// ── Replay Cards ───────────────────────────────────────────────────────────
export async function createReplayCard(data: InsertReplayCard) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(replayCards).values(data);
}

export async function getReplayCardByToken(shareToken: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.select().from(replayCards)
    .where(eq(replayCards.shareToken, shareToken)).limit(1);
  return result[0];
}

export async function getReplayCardByRoomId(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.select().from(replayCards)
    .where(eq(replayCards.roomId, roomId)).limit(1);
  return result[0];
}

// ── Challenge Responses ─────────────────────────────────────────────────────────
export async function upsertChallengeResponse(data: InsertChallengeResponse) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(challengeResponses).values(data)
    .onDuplicateKeyUpdate({ set: { responseType: data.responseType, textResponse: data.textResponse ?? null } });
}

export async function getChallengeResponsesForEvent(gameEventId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.select().from(challengeResponses)
    .where(eq(challengeResponses.gameEventId, gameEventId));
}
