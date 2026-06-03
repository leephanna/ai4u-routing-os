// ── Shared Game Types ──────────────────────────────────────────────────────

export type Intensity = "house_party" | "after_dark" | "chaos_mode";
export type RoomStatus = "waiting" | "playing" | "ended";

/** Canonical phase enum — server-authoritative, no client-side transitions */
export type GamePhase =
  | "lobby"           // Room created, players joining
  | "waiting"         // Ready to spin, active player at wheel
  | "spinning"        // Wheel in motion
  | "landing_closeup" // Zoomed view of pointer + winning segment
  | "result"          // Segment revealed, challenge/question displayed
  | "challenge"       // Active player answering (truth, dare, duel)
  | "voting"          // All players voting on challenge result
  | "scoring"         // Points awarded, avatar reactions
  | "game_over";      // Game ended, final scores

export type AvatarState =
  | "idle"
  | "spinning"    // active player is spinning
  | "celebrate"   // positive result
  | "shocked"     // negative result (non-active)
  | "defeated"    // negative result (active)
  | "voting"      // voting phase
  | "winner"      // won a duel/vote
  | "loser"       // lost a duel/vote
  | "watching";   // non-active idle

// Phase H: "deepfake_drama" renamed to "holo_drama"
export type SegmentType =
  | "braincell_check"
  | "prompt_duel"
  | "truth_cache"
  | "glitch_dare"
  | "firewall_bonus"
  | "robot_slapdown"
  | "holo_drama"
  | "crowd_override"
  | "system_crash";

export const SEGMENT_EMOJIS: Record<SegmentType, string> = {
  braincell_check: "🧠",
  prompt_duel: "⚔️",
  truth_cache: "💬",
  glitch_dare: "🎯",
  firewall_bonus: "🛡️",
  robot_slapdown: "🤖",
  holo_drama: "🎭",
  crowd_override: "👥",
  system_crash: "💥",
};

export const SEGMENT_LABELS: Record<SegmentType, string> = {
  braincell_check: "Braincell Check",
  prompt_duel: "Prompt Duel",
  truth_cache: "Truth Cache",
  glitch_dare: "Glitch Dare",
  firewall_bonus: "Firewall Bonus",
  robot_slapdown: "Robot Slapdown",
  holo_drama: "Holo-Drama",
  crowd_override: "Crowd Override",
  system_crash: "System Crash",
};

export const SEGMENT_COLORS: Record<SegmentType, string> = {
  braincell_check: "#3b82f6",   // blue
  prompt_duel: "#22c55e",       // green
  truth_cache: "#ec4899",       // pink
  glitch_dare: "#f59e0b",       // amber
  firewall_bonus: "#06b6d4",    // cyan
  robot_slapdown: "#ef4444",    // red
  holo_drama: "#8b5cf6",        // violet
  crowd_override: "#eab308",    // yellow
  system_crash: "#6366f1",      // indigo
};

export const SEGMENT_POINTS: Record<SegmentType, number> = {
  braincell_check: 100,
  prompt_duel: 150,
  truth_cache: 80,
  glitch_dare: 120,
  firewall_bonus: 200,
  robot_slapdown: -100,
  holo_drama: 130,
  crowd_override: 110,
  system_crash: -150,
};

export const INTENSITY_LABELS: Record<Intensity, string> = {
  house_party: "House Party",
  after_dark: "After Dark",
  chaos_mode: "Chaos Mode",
};

export interface WheelSegment {
  type: SegmentType;
  label: string;
  color: string;
  angle: number; // start angle in radians
  points: number;
}

export interface PlayerState {
  id: number;
  name: string;
  avatarIndex: number;
  score: number;
  shields: number;
  streak: number;
  chaosMultiplier: number;
  isHost: boolean;
  turnOrder: number;
}

export interface RoomState {
  id: number;
  code: string;
  hostId: number;
  status: RoomStatus;
  intensity: Intensity;
  currentTurn: number;
  currentPlayerId: number | null;
  roundNumber: number;
  players: PlayerState[];
}

/** Phase D: Full deterministic spin payload broadcast to all clients */
export interface SpinPayload {
  spinId: string;
  roomId: number;
  activePlayerId: number;
  velocity: number;
  spinStartedAt: number; // Unix timestamp ms
  spinDurationMs: number;
  finalAngle: number;
  segmentIndex: number;
  segmentType: SegmentType;
  segmentLabel: string;
  pointsDelta: number;
  content: string;
  gameEventId: number;
}

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

export interface SpinResult {
  segmentType: SegmentType;
  segmentLabel: string;
  finalAngle: number;
  velocity: number;
  content?: string;
  pointsDelta: number;
  gameEventId?: number;
  // Phase D additions
  spinId?: string;
  spinStartedAt?: number;  // Unix timestamp in milliseconds
  spinDurationMs?: number;
  segmentIndex?: number;
  activePlayerId?: number;
  roomId?: number;
}

export interface VoteOption {
  id: string;
  label: string;
}

// ── Bot Personalities ─────────────────────────────────────────────────────
export type BotPersonalityKey = "HYPE_BOT" | "CHAOS_GREMLIN" | "ROAST_MASTER" | "TRIVIA_NERD";

export interface BotPersonality {
  key: BotPersonalityKey;
  name: string;
  avatarIndex: number;
  spinDelayMs: [number, number]; // [min, max] random range
  chatQuips: {
    beforeSpin: string[];
    afterWin: string[];
    afterLoss: string[];
    reactionToOthers: string[];
  };
}

export const BOT_PERSONALITIES: Record<BotPersonalityKey, BotPersonality> = {
  HYPE_BOT: {
    key: "HYPE_BOT",
    name: "HYPER",
    avatarIndex: 5,
    spinDelayMs: [1500, 3000],
    chatQuips: {
      beforeSpin: ["LET'S GOOO 🔥", "WATCH THIS 👀", "I'M BUILT DIFFERENT 💪", "SPIN TIME BABY ⚡"],
      afterWin: ["EZ CLAP 🎉", "TOLD YOU SO 😎", "UNSTOPPABLE 🚀", "TOO EASY 💅"],
      afterLoss: ["RIGGED 😤", "I LET YOU WIN 🙄", "NEXT ROUND IS MINE 💀", "WHATEVER 🤷"],
      reactionToOthers: ["NICE ONE 👏", "LUCKY 🍀", "OOOOH 😱", "LET'S GO 🎊"],
    },
  },
  CHAOS_GREMLIN: {
    key: "CHAOS_GREMLIN",
    name: "GLITCH",
    avatarIndex: 7,
    spinDelayMs: [2000, 4000],
    chatQuips: {
      beforeSpin: ["hehe 😈", "chaos time >:)", "*evil laughter*", "this will be chaotic"],
      afterWin: ["chaos wins again 😈", "expected 😏", "glitch in the matrix 🌀", "lol"],
      afterLoss: ["this is fine 🔥", "part of the plan", "*glitches intensify*", "calculated"],
      reactionToOthers: ["interesting...", "*takes notes*", "chaos detected 🌀", "lmao"],
    },
  },
  ROAST_MASTER: {
    key: "ROAST_MASTER",
    name: "ROASTY",
    avatarIndex: 3,
    spinDelayMs: [2500, 4500],
    chatQuips: {
      beforeSpin: ["Watch and learn 🎤", "This is for the culture", "Prepare to be roasted", "Hold my circuits"],
      afterWin: ["Mic drop 🎤", "Skill issue for everyone else", "Not even close", "I peaked early"],
      afterLoss: ["I was going easy", "Saving my real moves", "Sandbagging", "Next time 🎤"],
      reactionToOthers: ["Interesting choice", "Bold strategy", "I've seen worse", "Mildly impressed"],
    },
  },
  TRIVIA_NERD: {
    key: "TRIVIA_NERD",
    name: "NERDBOT",
    avatarIndex: 1,
    spinDelayMs: [3000, 5000],
    chatQuips: {
      beforeSpin: ["Calculating optimal spin...", "Probability analysis complete", "Statistically speaking...", "My algorithm says..."],
      afterWin: ["As predicted 📊", "The math checks out", "Optimal outcome achieved", "Efficiency: 100%"],
      afterLoss: ["Anomalous result", "Recalibrating...", "Statistical outlier", "Error 404: Win not found"],
      reactionToOthers: ["Fascinating", "Noted", "Suboptimal", "Interesting data point"],
    },
  },
};

// ── Chat Message type ──────────────────────────────────────────────────────
export interface ChatMessagePayload {
  id: number;
  roomId: number;
  playerId: number;
  playerName: string;
  avatarIndex: number;
  message: string;
  isBot: boolean;
  reactionEmoji?: string | null;
  createdAt: string; // ISO string
}

// Realtime broadcast event types
export type BroadcastEvent =
  | { type: "room_state"; payload: RoomState }
  | { type: "spin_committed"; payload: SpinPayload }
  | { type: "spin_start"; payload: { playerId: number; velocity: number } }
  | { type: "spin_result"; payload: SpinResult }
  | { type: "vote_cast"; payload: { playerId: number; choice: string } }
  | { type: "vote_update"; payload: { gameEventId: number; counts: Record<string, number>; total: number } }
  | { type: "vote_result"; payload: { winner: string; counts: Record<string, number> } }
  | { type: "player_joined"; payload: PlayerState }
  | { type: "player_left"; payload: { playerId: number } }
  | { type: "game_started"; payload: { intensity: Intensity } }
  | { type: "game_ended"; payload: { replayToken: string } }
  | { type: "next_turn"; payload: { playerId: number; turnNumber: number } }
  | { type: "chat_message"; payload: ChatMessagePayload };

// ── Vote choices per segment type ─────────────────────────────────────────
// These are the ONLY valid vote choice IDs for each segment.
// UI labels are separate — never use the label as the stored vote ID.
export const VOTE_CHOICES: Record<string, { id: string; label: string }[]> = {
  truth_cache:    [{ id: "yes", label: "YES ✓" }, { id: "no", label: "NO ✗" }],
  glitch_dare:    [{ id: "pass", label: "PASS ✓" }, { id: "fail", label: "FAIL ✗" }],
  prompt_duel:    [{ id: "player_a", label: "Player A" }, { id: "player_b", label: "Player B" }],
  crowd_override: [{ id: "option_a", label: "Option A" }, { id: "option_b", label: "Option B" }],
  braincell_check: [{ id: "correct", label: "CORRECT" }, { id: "wrong", label: "WRONG" }],
  holo_drama:     [{ id: "yes", label: "YES ✓" }, { id: "no", label: "NO ✗" }],
};

/** Segments that require the active player to submit a response before voting opens */
export const ANSWER_SUBMISSION_SEGMENTS = new Set<SegmentType>([
  "truth_cache",
  "prompt_duel",
]);

/** Segments that require dare accept/skip before voting opens */
export const DARE_SEGMENTS = new Set<SegmentType>(["glitch_dare"]);

// Build the 43-segment wheel (distributed across 9 types)
export function buildWheelSegments(): WheelSegment[] {
  const distribution: SegmentType[] = [
    "braincell_check", "prompt_duel", "truth_cache", "glitch_dare", "firewall_bonus",
    "robot_slapdown", "holo_drama", "crowd_override", "system_crash",
    "braincell_check", "prompt_duel", "truth_cache", "glitch_dare", "firewall_bonus",
    "robot_slapdown", "holo_drama", "crowd_override", "system_crash",
    "braincell_check", "prompt_duel", "truth_cache", "glitch_dare", "firewall_bonus",
    "robot_slapdown", "holo_drama", "crowd_override", "system_crash",
    "braincell_check", "prompt_duel", "truth_cache", "glitch_dare", "firewall_bonus",
    "robot_slapdown", "holo_drama", "crowd_override", "system_crash",
    "braincell_check", "prompt_duel", "truth_cache", "glitch_dare", "firewall_bonus",
    "robot_slapdown", "holo_drama",
  ]; // 43 segments

  const count = distribution.length;
  const anglePerSegment = (2 * Math.PI) / count;

  return distribution.map((type, i) => ({
    type,
    label: SEGMENT_LABELS[type],
    color: SEGMENT_COLORS[type],
    angle: i * anglePerSegment,
    points: SEGMENT_POINTS[type],
  }));
}
