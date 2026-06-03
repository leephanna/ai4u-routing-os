import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  float,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ── Users ──────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Rooms ──────────────────────────────────────────────────────────────────
export const rooms = mysqlTable("rooms", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 6 }).notNull().unique(),
  hostId: int("hostId").notNull(),
  status: mysqlEnum("status", ["waiting", "playing", "ended"]).default("waiting").notNull(),
  intensity: mysqlEnum("intensity", ["house_party", "after_dark", "chaos_mode"]).default("house_party").notNull(),
  currentTurn: int("currentTurn").default(0).notNull(),
  currentPlayerId: int("currentPlayerId"),
  roundNumber: int("roundNumber").default(1).notNull(),
  maxPlayers: int("maxPlayers").default(8).notNull(),
  currentEventId: int("currentEventId"),
  currentPhase: varchar("currentPhase", { length: 32 }).default("waiting").notNull(),
  lastSpinResultJson: json("lastSpinResultJson"),
  lastSpinVelocity: float("lastSpinVelocity"),
  spinId: varchar("spinId", { length: 36 }),
  spinStartedAt: timestamp("spinStartedAt"),
  spinDurationMs: int("spinDurationMs"),
  finalAngle: float("finalAngle"),
  segmentIndex: int("segmentIndex"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = typeof rooms.$inferInsert;

// ── Players ────────────────────────────────────────────────────────────────
export const players = mysqlTable("players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId"),
  guestSessionId: varchar("guestSessionId", { length: 64 }),
  guestName: varchar("guestName", { length: 32 }),
  avatarIndex: int("avatarIndex").default(0).notNull(),
  score: int("score").default(0).notNull(),
  shields: int("shields").default(0).notNull(),
  streak: int("streak").default(0).notNull(),
  chaosMultiplier: float("chaosMultiplier").default(1.0).notNull(),
  isHost: boolean("isHost").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  turnOrder: int("turnOrder").default(0).notNull(),
  isBot: boolean("isBot").default(false).notNull(),
  botPersonality: varchar("botPersonality", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;

// ── Game Events (spin results, segment outcomes) ───────────────────────────
export const gameEvents = mysqlTable("game_events", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  playerId: int("playerId").notNull(),
  roundNumber: int("roundNumber").notNull(),
  segmentType: varchar("segmentType", { length: 32 }).notNull(),
  segmentLabel: varchar("segmentLabel", { length: 64 }).notNull(),
  content: text("content"),
  spinVelocity: float("spinVelocity"),
  outcome: text("outcome"),
  pointsDelta: int("pointsDelta").default(0).notNull(),
  isFunny: boolean("isFunny").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameEvent = typeof gameEvents.$inferSelect;
export type InsertGameEvent = typeof gameEvents.$inferInsert;

// ── Votes ──────────────────────────────────────────────────────────────────
export const votes = mysqlTable("votes", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  gameEventId: int("gameEventId").notNull(),
  playerId: int("playerId").notNull(),
  choice: varchar("choice", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueVote: uniqueIndex("unique_vote").on(table.gameEventId, table.playerId),
}));

export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;

// ── Chat Messages ─────────────────────────────────────────────────────────
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  playerId: int("playerId").notNull(),
  playerName: varchar("playerName", { length: 32 }).notNull(),
  avatarIndex: int("avatarIndex").default(0).notNull(),
  message: text("message").notNull(),
  isBot: boolean("isBot").default(false).notNull(),
  reactionEmoji: varchar("reactionEmoji", { length: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ── Challenge Responses (truth/dare/duel answers) ────────────────────────
export const challengeResponses = mysqlTable("challenge_responses", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  gameEventId: int("gameEventId").notNull(),
  playerId: int("playerId").notNull(),
  segmentType: varchar("segmentType", { length: 32 }).notNull(),
  responseType: varchar("responseType", { length: 32 }).notNull(), // answer | skip | dare_accept | dare_skip | duel_answer
  textResponse: text("textResponse"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueResponse: uniqueIndex("unique_challenge_response").on(table.gameEventId, table.playerId),
}));
export type ChallengeResponse = typeof challengeResponses.$inferSelect;
export type InsertChallengeResponse = typeof challengeResponses.$inferInsert;

// ── Replay Cards ───────────────────────────────────────────────────────────
export const replayCards = mysqlTable("replay_cards", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  shareToken: varchar("shareToken", { length: 32 }).notNull().unique(),
  winnerName: varchar("winnerName", { length: 64 }),
  winnerScore: int("winnerScore"),
  totalRounds: int("totalRounds"),
  playerCount: int("playerCount"),
  funnySummary: text("funnySummary"),
  statsJson: json("statsJson"),
  storageUrl: text("storageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReplayCard = typeof replayCards.$inferSelect;
export type InsertReplayCard = typeof replayCards.$inferInsert;
