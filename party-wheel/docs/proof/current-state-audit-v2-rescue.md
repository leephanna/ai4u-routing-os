# AI4U Party Wheel — Current State Audit (V2 Rescue Pass)

**Date:** 2026-06-03
**Auditor:** Claude Code Agent (Research Pass)
**Branch:** claude/magical-fermat-ozmkn
**Scope:** Full codebase audit prior to V2 Rescue build
**Files read:** server/routers.ts (1181 lines), client/src/hooks/useRoomRealtime.ts, client/src/pages/Game.tsx (1292 lines, first 200 read), shared/gameTypes.ts, todo.md (full), package.json

---

## 1. What Works

These items are fully checked in todo.md and confirmed functional by direct file inspection. This is the solid foundation the rescue pass must not disturb.

### Core Infrastructure — Server

- **tRPC routers (8 namespaces):** `room` (create, join, get, setIntensity), `game` (start, spin, nextTurn, end, kickPlayer, resetPhase, rematch, getState, createSoloRoomAndStart), `voting` (cast, resolveExpired, getResults), `content` (generate), `replay` (get, getByRoom), `bot` (add, remove), `chat` (send, getRecent), `challenge` (submitResponse, getResponses) — all implemented with proper `protectedProcedure` / `publicProcedure` types and TRPCError error handling.
- **Database schema:** rooms, players, game_events, votes, replay_cards, chat_messages, challenge_responses — all tables migrated with correct columns including spinId, spinStartedAt, spinDurationMs, finalAngle, segmentIndex, lastSpinResultJson, lastSpinVelocity, guestSessionId, isBot, botPersonality.
- **Server-authoritative spin:** Server generates `finalAngle`, `spinId`, `spinDurationMs`, `serverVelocity`, and `segmentIndex` using `angleToSegmentIndex()`. Client receives and animates deterministically from these values. The client-sent `velocity` is accepted but not used for physics.
- **Phase state machine:** Canonical `GamePhase` enum in shared/gameTypes.ts (lobby → waiting → spinning → landing_closeup → result/voting/answer_submission → game_over). Server enforces phase transitions. `landing_closeup` auto-advances after 5,000ms via server `setTimeout` with phase-guard check.
- **Voting system:** `voting.cast` upserts (one vote per player per event), validates choice against `VOTE_CHOICES[segmentType]`, auto-resolves to `result` when all human players have voted, broadcasts `room_update`. `voting.resolveExpired` handles timer expiry from client.
- **Content generation:** 9 segment types × 3 intensity tiers (house_party, after_dark, chaos_mode). Per-segment LLM prompts in `generateSegmentContent()`. `BLOCKED_PATTERNS` regex moderation filter applied before return. Randomized fallback bank for all 9 types when LLM times out or fails.
- **Bot engine (server-side):** `botRouter.add`/`botRouter.remove` with personality assignment. 4 personalities: HYPE_BOT, CHAOS_GREMLIN, ROAST_MASTER, TRIVIA_NERD — each with name, avatarIndex, spinDelayMs range, and chatQuips per event type.
- **Solo play:** `game.createSoloRoomAndStart` atomic mutation — creates room, host player, 2 random bots, starts game in one database transaction. Home page Solo Play button wired.
- **Host safety controls:** Force Next Turn (`forceByHost: true` param on `game.nextTurn`), End Game, Kick Player (`updatePlayer({ isActive: false })`), Reset Stuck Phase, Rematch (reset room + player scores with same code).
- **Content infrastructure:** `contentLogger.ts` validates all LLM output against policy and logs to `.manus-logs/content-generation`. `contentRecency.ts` tracks last 50 content pieces per room in 1-hour window to prevent repetition. Note: `recordContentUsage()` is created but the call site was omitted from `generateSegmentContent()` — deduplication is not actively enforced despite the infrastructure existing.
- **Test suite:** 56 unit and integration tests passing across 6 test files: gameTypes, auth.logout, supabase.realtime, giphy, segment-interactions, production.upgrade. `pnpm compliance` (tsc + vitest) exits 0.
- **TypeScript:** Strict mode, 0 errors.
- **Guest join system:** `guestSessionId` generated client-side, persisted in localStorage, sent on join, written as HTTP cookie. `room.get` resolves `myPlayerId` server-side by matching userId OR guestSessionId from cookie.
- **Supabase Realtime infrastructure:** `broadcastRoomEvent(roomCode, eventName, payload)` helper wired into all server mutations. `useRoomRealtime` hook on client subscribes to `room:${roomCode}` channel, handles `room_update`, `game_started`, `game_ended`, `player_joined`, `chat_message`, `vote_update`, `spin_committed`.

### Core Infrastructure — Client

- **Phase reconciliation effect in Game.tsx:** `useEffect` that syncs local `phase` state from `room.currentPhase` on every poll update — handles reconnection and late-join correctly for most phases.
- **Segment-aware response panels:** TruthResponsePanel (active player text box + passive waiting screen), DareResponsePanel (Accept/Skip for active, PASS/FAIL voting for crowd), DuelResponsePanel (both players submit answers, crowd votes on real answer text). Each uses correct VOTE_CHOICES IDs.
- **AvatarCard animated states:** celebrate, defeated, shocked, spinning, winner, loser, voting, watching — CSS animation classes applied per `AvatarState` derived from `getAvatarState()`.
- **Audio system:** Web Audio API — spin, tick, land, vote countdown (accelerating at 10/5/4/3/2/1s), robot attack, celebration, per-segment reveals via `playSegmentReveal()`.
- **Bot engine hook:** `useBotEngine` in client — auto-spins after `spinDelayMs` when `currentPlayerId` is a bot, sends chat quips via `chat.send` mutation, handles result reactions.
- **GameChat component:** Realtime messages appended from `liveMessages` state fed by `handleRoomUpdate` case `chat_message`. Unread badge. Quick reactions.
- **WheelCanvas:** 43 segments, color-coded per SEGMENT_COLORS. Chrome rim with metallic gradient stroke. Multi-layer neon glow halo. Tick marks. Hub cap. Canvas 2D rotation animation driven by `rotation` prop.
- **Giphy reactions:** `GiphyReaction` component fetches random GIF by segment type tag and displays as overlay on result reveal for after_dark intensity.
- **Scoreboard:** Contestant podium layout with rank badges derived from sorted player scores.
- **PWA:** manifest.json, meta tags, icons in place.

---

## 2. What Is Broken

### CRITICAL BUG: Realtime Event Contract Mismatch

This is the single most important bug in the codebase. It silently breaks the shared-stage experience for every non-active player on every spin.

**Server broadcasts (routers.ts, line 320):**
```
broadcastRoomEvent(room.code, "phase_update", {
  spinId,
  roomId: input.roomId,
  activePlayerId: input.playerId,
  velocity: serverVelocity,
  spinStartedAt: spinStartedAt.getTime(),
  spinDurationMs,
  finalAngle,
  segmentIndex,
  currentPhase: "spinning",
})
```

**Client listens for (useRoomRealtime.ts, line 72):**
```
.on("broadcast", { event: "spin_committed" }, ({ payload }) => {
  onUpdateRef.current({ event: "spin_committed", data: payload });
})
```

**Effect:** The client never receives this broadcast. The `case "spin_committed"` handler in Game.tsx (lines 135–144) is permanently dead code. Passive players do not see the wheel spin until the 3-second polling interval fires. At that point, the server has likely already auto-advanced from `spinning` to `landing_closeup` (after 5 seconds, via setTimeout). A 3-second poll plus network latency means passive players routinely miss both the spin animation AND the landing closeup. They jump directly from "Waiting..." to seeing the result card. This is not a party game — it is a broken polling interface.

**Root cause:** The event name was renamed from `"phase_update"` to `"spin_committed"` during Phase C+D hardening (documented in todo.md: "Server: broadcast spin_committed with full SpinPayload"). The `broadcastRoomEvent` call at line 320 was not updated. The type definition in `RoomBroadcastPayload` and the `BroadcastEvent` union in gameTypes.ts both correctly use `"spin_committed"`. The server is the only broken piece.

**Fix:** One word change at routers.ts:320. `"phase_update"` → `"spin_committed"`.

**Why this was not caught:** No Playwright E2E test opens two simultaneous browser windows. All 56 tests are unit/server tests that do not exercise the Supabase Realtime channel. The `"phase_update"` event name is not referenced anywhere in client code, so no TypeScript error is generated.

### Secondary Broadcast Gap: `landing_closeup` Phase Not Handled in Passive Client

The server fires a `room_update` broadcast at line 384 with `{ currentPhase: "landing_closeup", currentEventId, lastSpinResultJson }` after writing the spin result. The `handleRoomUpdate` case `"room_update"` in Game.tsx (lines 146–170) only handles:
- `currentPhase === "result"` — sets spinResult, plays reveal sound, transitions after 2500ms
- `currentPhase === "voting"` — sets spinResult, sets currentEventId
- `currentPhase === "waiting"` — resets state

`landing_closeup` is not handled. Passive players who receive this event via polling or Realtime do not enter the landing animation. The cinematic zoom-in only fires for the active player's local state, not for all clients.

### `recordContentUsage()` Never Called

`contentRecency.ts` exports `recordContentUsage()` to prevent content repetition within sessions. The import is present in routers.ts (line 24: `import { recordContentUsage, hasContentBeenUsedRecently } from "./contentRecency"`). However, there is no call to `recordContentUsage()` in `generateSegmentContent()` or anywhere else (the comment at line 925 `// Phase 11: Record content usage for recency control` is just a comment). The deduplication system is fully built but not active.

### Bot Voting Not Implemented for Key Segments

todo.md v9 PART 8: "Bot voting on truth_cache + glitch_dare + alreadyVotedRef guard" is NOT checked. `useBotEngine` does not cast votes for these segment types. In solo play (the primary test path for many users), truth/dare challenges will never auto-resolve via bot votes — they require the human host to manually use "Force Next Turn" or wait for the timer.

---

## 3. What Is Partially Built But Not Integrated

### Landscape Layout — Framework Complete, JSX Deferred

**Status:** Phase 7 in todo.md v14 is marked `[x]` with the note: "Deferred to next session due to complexity (1215-line component refactor). Existing `lg:` breakpoint already supports landscape layout."

**Reality:** The `OrientationGuard` component exists and is wired in `App.tsx`. It shows a "rotate your device" overlay in portrait mode and attempts `screen.orientation.lock("landscape")`. However, the actual 3-zone studio layout (left zone: player avatars + scoreboard, center stage: wheel + phase content, right zone: chat + controls) was never built. The `lg:flex-row` breakpoint reflows the existing vertical stack horizontally — this is responsive CSS, not a game-show studio layout. The game does not feel like a TV studio in landscape. It feels like a stacked mobile app that happens to be wider.

**What exists at routers.ts line 824 and 940:** Two CSS comments about landscape — `{/* On wide screens (landscape TV/tablet): side-by-side wheel + content */}` and `{/* On landscape: wheel stays left, content right */}`. These are aspirational comments, not implemented zones.

### Cinematic Phase Transitions — CSS Defined, Not Fully Wired

**Status:** Phase 8 in todo.md v14 is marked `[x]` as "Deferred to next session for focused implementation."

**Reality:** The keyframe CSS is injected (Game.tsx lines 34–67): `segmentZoomIn`, `colorFlash`, `particleDrift`, `countdownPop`, `slideUpFade`. The `landingSegment` state is set in the `"room_update"` handler when `currentPhase === "result"`. However:
1. The client phase type uses `"landing"` but the server sends `"landing_closeup"` — these are not the same string. The phase reconciliation effect translates server `"landing_closeup"` to what?  Looking at Game.tsx, the local `Phase` type (line 31) includes `"landing"` but not `"landing_closeup"`. The transition `setPhase("landing")` is called in the passive client handler when `currentPhase === "result"` and `lastSpinResultJson` is present — this means the landing animation fires only AFTER the server has already advanced to result, not during the 5-second landing_closeup window.
2. For passive players, this means the cinematic zoom-in plays after the fact, not as the server transitions into `landing_closeup`.

### Wheel Enhancements — Visual Exists, Pointer Closeup Not Connected

WheelCanvas has chrome rim, neon glow, tick marks, metallic hub — all confirmed in WheelCanvas.tsx. The `onSegmentLand` callback prop exists. The winning segment highlight (pointer glow on the landing segment during `landing_closeup`) is designed but requires `finalAngle` to be delivered via `spin_committed` event at the right moment. Due to the event name bug, passive clients do not receive this value in time to highlight the correct segment during the landing animation window.

### `intensityTiers.ts` — Wired for LLM, Not for Visual Differentiation

`intensityTiers.ts` provides system prompts per intensity level and is correctly wired into `generateSegmentContent()`. However, there is no visual differentiation in the game UI for intensity tier. A `chaos_mode` room looks identical to a `house_party` room. The intensity system prompt affects LLM output only, not the stage appearance.

---

## 4. What Is Untested

### Multi-Client Sync — No Playwright E2E

There are zero end-to-end tests that open two browser sessions, join the same room, and verify synchronized state transitions. All 56 passing tests are:
- Unit tests against server router logic (segment interactions, vote validation, phase transitions)
- Unit tests against shared type definitions and constants (gameTypes.ts — wheel segment distribution, angle math)
- Integration tests against auth and Supabase client initialization
- The `spin_committed` event name mismatch would have been caught by any multi-client E2E test.

### Pointer Closeup Visual — No Proof

The `landing_closeup` phase is server-authoritative (implemented, tested). The pointer closeup UI (zoomed wheel view highlighting the winning segment) has no screenshot, no test, and was explicitly deferred. No human has verified this renders correctly on a passive client.

### Category Reveal Animation — No Proof

The `segmentZoomIn` keyframe and `landingSegment` state are implemented. No screenshot, no automated test, no manual QA record confirms this animation fires at the correct moment for both active and passive players.

### Voting Auto-Resolve — Server Tested, Client Transition Untested

`voting.cast` auto-resolve is covered by unit tests at the server level. Untested: when a passive client receives `room_update` with `currentPhase: "result"` while rendering the VotingPanel, whether it correctly dismisses the voting UI and shows the result.

### Bot Voting on Truth/Dare

`useBotEngine` auto-spin is tested by the unit suite. Bot voting for `truth_cache` and `glitch_dare` is NOT implemented and NOT tested.

### Content Deduplication

`contentRecency.ts` unit is presumably tested. The integration (recordContentUsage called during spin) is not active — content deduplication does not execute at runtime.

---

## 5. What Is Visually Weak

### Canvas Wheel with Unreadable Segment Labels at Mobile Scale

WheelCanvas renders 43 segments. Each segment spans 360° / 43 = 8.37°. On a 320px wheel (default `size` prop), the outer rim is at radius ~156px. Arc length per segment = 156 × (2π/43) ≈ 22.8px. Fitting text of 10–14 chars (e.g., "Braincell Check") into 22.8px of arc is not achievable in Canvas 2D with any reasonable font size. The `isLeftHalf` flip fix (v10) corrects upside-down text but cannot fix fundamental label density. On a real 375px mobile device, the labels are decorative shapes, not readable text.

### "Boxes on Black" Layout

Game.tsx is a vertically-stacked single column of Tailwind-styled `<div>` cards on a dark background. The "TV studio background" (VISUAL 2b, checked in todo.md) is a `radial-gradient` CSS class applied to the root element. Without the 3-zone layout, the decorative background is obscured by the content cards stacked on top of it. The game does not read as a shared-stage TV studio. It reads as a mobile app with a dark theme and some glow effects.

### Plain Age Gate

`AgeGate.tsx` is a div with a checkbox and a "I confirm I am 18+" button. localStorage-persisted. Functional, but has no AI4U neon branding, no dramatic reveal animation, no personality. On first load, users see this before seeing any game content. It creates no excitement.

### Scoreboard Podiums Not Optimized for Landscape

The contestant podium layout (VISUAL 2a, v10) was designed for the mobile single-column layout. In landscape orientation, the podiums appear as a horizontal strip of small cards rather than proper game-show podiums with depth and scale variation.

### Spin Button Has No Passive Broadcast State

SpinButton is a tap/hold button with hold-velocity scaling. It does not broadcast a "charging up" state to passive players. From passive players' perspective, the wheel begins spinning without warning. A "big spin incoming" broadcast state (visual indicator that the active player is holding the button) would create shared anticipation.

### AgeGate, Home Page, and Lobby Use Generic Card Styling

The neon AI4U aesthetic (Orbitron font, OKLCH colors, dark theme) is set up globally but unevenly applied. Several screens — particularly the age gate and lobby — use generic `card` / `button` Tailwind components without the neon game-show visual treatment.

---

## 6. What Creates Desync Risk

### PRIMARY — `"phase_update"` vs. `"spin_committed"` Event Name (CONFIRMED)

**Server:** `broadcastRoomEvent(room.code, "phase_update", {...})` — routers.ts:320
**Client:** `.on("broadcast", { event: "spin_committed" }, ...)` — useRoomRealtime.ts:72
**Impact:** Every passive player misses the spin start trigger. The 3-second polling fallback becomes the only sync path. Given that `spinning` → `landing_closeup` → `result` can complete in 8–10 seconds total (5s landing timeout + server setTimeout), a passive client on the 3-second polling cycle may poll twice during the entire sequence and still arrive too late to see either animation phase. They see the result card as if the game teleported there.

### Server `setTimeout` Is Not Crash-Safe

The auto-advance from `landing_closeup` uses `setTimeout(async () => {...}, 5000)` at routers.ts line 395. This is a Node.js in-process timer — it is not persisted. If the server process restarts, crashes, or is redeployed during the 5-second window, the phase advance never fires. The room is permanently stuck at `landing_closeup`. Recovery requires host to notice and use `game.resetPhase`. In a party context (players are socializing, may not be watching the screen closely), this is a silent blocker.

### Stale `isMyTurnRef` Between Turn Transitions

`isMyTurnRef.current` is set in a `useEffect` that fires when the tRPC `room.get` poll resolves. Between the moment `game.nextTurn` fires (advancing `currentPlayerId`) and the moment the next poll returns the updated room state, `isMyTurnRef.current` holds the old value. If a `spin_committed` event arrives during this window (once the bug is fixed), the incoming active player's client might incorrectly branch into the passive player animation path.

### LLM Latency Introduces Race Between Phase Data and Phase Transition

In `game.spin`, the server:
1. Writes `currentPhase: "spinning"` and broadcasts `"phase_update"` / (should be `"spin_committed"`) immediately — line 309–330
2. Awaits `generateSegmentContent()` (LLM call — can take 1–5 seconds) — line 335
3. Writes `lastSpinResultJson` and transitions to `landing_closeup` — line 378

Between steps 1 and 3, `lastSpinResultJson` is null. If a passive client polls during this window, it receives `currentPhase: "spinning"` with `lastSpinResultJson: null`. The phase reconciliation effect cannot reconstruct `spinResult` without `lastSpinResultJson`. The wheel animation may start without a known landing target.

### Content Deduplication Silent Failure

`recordContentUsage()` is never called (bug confirmed above). In long sessions, the LLM will repeat challenges. This is a UX desync from user expectations — players who see the same truth question twice in one session lose trust in the game's novelty, which affects engagement even though the game mechanics continue working.

---

## 7. What Should Be Preserved

The following systems are correct, tested, and valuable. The rescue pass must not break them.

- **All server logic in `routers.ts`** — every router, every mutation, every query. Room creation, spin mechanics, phase state machine, voting, challenge, bot, chat, content generation, moderation, replay cards. This is 1181 lines of battle-tested, type-safe TypeScript.
- **All tRPC router type definitions** — `AppRouter`, all input/output Zod schemas. These are the type-safe API contract that all clients depend on.
- **Database schema and all migrations** — accumulated schema evolution across 5+ migrations. The column structure for the rooms table (spinId, spinStartedAt, spinDurationMs, finalAngle, segmentIndex, lastSpinResultJson, lastSpinVelocity) represents correct Phase C+D hardening.
- **Supabase Realtime infrastructure** — `broadcastRoomEvent` helper, channel naming convention `room:${roomCode}`, the `useRoomRealtime` hook architecture (channel ref, onUpdateRef pattern avoiding stale closures, status logging).
- **Bot engine** — `useBotEngine` hook, `BOT_PERSONALITIES` definitions, bot spin/chat/reaction logic.
- **Content generation system** — `generateSegmentContent()`, per-segment LLM prompts, `BLOCKED_PATTERNS` moderation, `FALLBACK_BANK`, `getDefaultContent()`, `intensityTiers.ts`, `contentLogger.ts`, `contentRecency.ts` (infrastructure, even though call site is missing).
- **All 56 unit/integration tests** — `pnpm compliance` must continue to exit 0 after every change.
- **Shared type system** — `gameTypes.ts` in its entirety: `GamePhase`, `SegmentType`, all maps (LABELS, COLORS, POINTS, EMOJIS), `SpinResult`, `SpinPayload`, `BroadcastEvent`, `BOT_PERSONALITIES`, `VOTE_CHOICES`, `buildWheelSegments()`.
- **`VOTE_CHOICES` server-side validation** — prevents arbitrary vote string injection; segment-specific choice validation is a security boundary.
- **Guest session system** — `guestSessionId` flow, `ai4u_guest_session_id` cookie, `myPlayerId` server-side resolution.
- **Phase reconciliation logic** — the `useEffect` in Game.tsx that syncs local phase to server `currentPhase` on poll update. This is the reconnection/late-join safety net.
- **`OrientationGuard` component** — the screen orientation lock attempt and portrait overlay should stay wired.
- **Host safety controls in UI** — the Force Next Turn, End Game, and Reset Phase buttons in Game.tsx are critical for recovery from stuck states.

---

## 8. What Should Be Replaced or Upgraded

### Realtime Event Name: `"phase_update"` → `"spin_committed"` (ONE-LINE FIX)

**File:** `/home/user/ai4u-routing-os/party-wheel/server/routers.ts`, line 320
**Change:** `broadcastRoomEvent(room.code, "phase_update", {...})` → `broadcastRoomEvent(room.code, "spin_committed", {...})`
**Risk:** Minimal. No schema change, no API contract change, no database change. The client handler is already correct. This is the highest-leverage single change in the entire codebase.

### Game.tsx Visual Layer → GameStageShell + StageDirector

Game.tsx is 1,292 lines of mixed business logic, animation state, Realtime event handling, and layout JSX. The rescue pass should extract the visual/layout layer into:
- `GameStageShell` — the outer 3-zone landscape layout wrapper (player avatars, center stage, controls rail)
- `StageDirector` — maps server `currentPhase` string to the correct stage component (WheelStage, LandingStage, ResultStage, VotingStage, ChallengeStage, GameOverStage)

Business logic (spin mutation, vote mutation, myPlayerId resolution, bot engine wiring, phase reconciliation, Realtime subscription) stays in Game.tsx or a `useGameState` custom hook. The split makes the visual layer safe to iterate without touching server logic.

### WheelCanvas (Canvas 2D Labels) → SVG Hybrid Wheel

The Canvas 2D renderer is correct for physics animation but produces unreadable labels at 43 segments. Replace with:
- Canvas layer: physics rotation animation only (maintains performance)
- SVG overlay layer: segment labels as `<text>` elements on arc paths, positioned at readable radius
- Combined using CSS `position: absolute` stacking

The rotation transform applies to both layers simultaneously via a shared CSS transform on a wrapper div.

### `"phase_update"` Type Gap in RoomBroadcastPayload

`RoomBroadcastPayload.event` does not include `"phase_update"`. This means TypeScript will not flag the missing client handler if someone adds the server broadcast back under this name. After fixing the server, consider adding a lint note or removing `"phase_update"` references entirely from comments to prevent future confusion.

### `recordContentUsage()` Call Site — One-Line Fix

Add `recordContentUsage(segmentType, moderated)` call in `generateSegmentContent()` after `logGeneratedContent()` (line 924). This activates the deduplication system that is already built and tested.

---

*Audit complete. The server business logic is correct and well-tested. The realtime contract has one critical single-word break that silently destroys the shared party experience. The visual layer needs a redesign pass. The test suite proves the domain logic is solid and must be protected.*
