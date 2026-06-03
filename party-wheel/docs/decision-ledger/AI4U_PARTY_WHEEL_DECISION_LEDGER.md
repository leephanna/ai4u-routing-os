# AI4U Party Wheel — Decision Ledger

**Project:** AI4U Party Wheel: Glitch After Dark
**Ledger version:** V2 Rescue Pass
**Start date:** 2026-06-03
**Branch:** claude/magical-fermat-ozmkn
**Maintainer:** Lee Hanna (leehanna8@gmail.com)

This ledger records permanent architectural and product decisions. Each entry explains what was decided, why, what was rejected, and what proof is required before the decision is considered implemented.

---

## DL-001 — Repair vs. Replace: Game.tsx Visual Layer

| Field | Value |
|-------|-------|
| **Decision ID** | DL-001 |
| **Date** | 2026-06-03 |
| **Decision** | Extract the visual layer from Game.tsx into `GameStageShell` + `StageDirector` rather than continuing to patch Game.tsx in place |
| **Status** | ACCEPTED |

**Context:** Game.tsx has grown to 1,292 lines across 15+ development passes. It contains tRPC query/mutation hooks, Realtime event handling, phase reconciliation, bot engine wiring, animation refs, vote timer, countdown timer, live chat state, and all visual layout JSX. This mixed-concerns architecture has made it progressively harder to change visuals without touching server logic, and vice versa. Phase 7 (3-zone landscape layout) and Phase 8 (cinematic transitions) were both deferred multiple times specifically because the refactor risk in a 1,200-line monolith was too high.

**Options Considered:**

- **Option A — Continue patching Game.tsx in place.** Add more conditional JSX blocks, more `useEffect`s, more state. Low immediate risk but compound technical debt. Every future visual change requires understanding all 1,292 lines.
- **Option B — Extract visual layer into GameStageShell + StageDirector (CHOSEN).** `GameStageShell` provides the 3-zone landscape layout shell. `StageDirector` maps `currentPhase` → visual stage component. Game.tsx retains all business logic and effects. Visual iteration becomes safe.
- **Option C — Rewrite Game.tsx from scratch.** Would eliminate all accumulated debt but risks losing correct behavior (phase reconciliation, stale closure guards, animation refs). Requires full multi-client re-verification.

**Chosen Option:** B — Extract visual layer.

**Rejected Options:** Option A rejected because it does not address the root cause of deferred phases. Option C rejected because the business logic in Game.tsx is correct and tested; rewriting it from scratch introduces regression risk with no safety net.

**Reason:** Separation of concerns is the correct architectural decision. The business logic (server calls, Realtime events, phase state) is stable and well-understood. The visual layer (layout, transitions, stage design) needs rapid iteration. Mixing them in one file creates a change amplification problem: every visual tweak requires a full cognitive load of 1,292 lines.

**Files Affected:**
- `client/src/pages/Game.tsx` — refactored to house logic only (or minimal presentation)
- `client/src/components/GameStageShell.tsx` — new file (3-zone layout wrapper)
- `client/src/components/StageDirector.tsx` — new file (phase → component router)
- `client/src/stages/WheelStage.tsx`, `LandingStage.tsx`, `ResultStage.tsx`, etc. — new stage files (if fully decomposed)

**Proof Required:**
- `pnpm compliance` passes (all 56 tests, 0 TS errors) after extraction
- Manual test: all 9 game phases transition correctly in a solo play session
- Screenshot of the 3-zone landscape layout rendering on a 1024×768 viewport

---

## DL-002 — Canvas Wheel vs. SVG Wheel vs. Hybrid Wheel

| Field | Value |
|-------|-------|
| **Decision ID** | DL-002 |
| **Date** | 2026-06-03 |
| **Decision** | Implement a hybrid wheel: Canvas 2D layer for rotation physics animation, SVG overlay layer for segment labels |
| **Status** | ACCEPTED |

**Context:** WheelCanvas.tsx renders all 43 wheel segments, colors, labels, chrome rim, glow effects, and tick marks on a single Canvas 2D context. With 43 segments, each segment spans ~8.37 degrees. Canvas 2D text rendering at this density produces illegible labels on a 320–375px mobile screen. The `isLeftHalf` flip fix (v10) addresses upside-down text orientation but cannot fix the fundamental label density problem. A party game wheel must be readable — players need to see segment names.

**Options Considered:**

- **Option A — Pure Canvas 2D (current).** Fast, all in one render, good physics. Labels are illegible at mobile scale. No improvement path without a complete rewrite.
- **Option B — Pure SVG wheel.** SVG `<path>` segments with `<textPath>` labels render at device pixel ratio, fully readable. However, pure SVG physics animation (rotating 43 segments at 60fps) is CPU-intensive and causes layout thrashing due to DOM mutation. Worse performance than Canvas for animation.
- **Option C — Hybrid: Canvas for animation, SVG for labels (CHOSEN).** Canvas layer renders the background fills, glow, chrome rim, tick marks, and drives the rotation transform. SVG layer (absolutely positioned on top, same dimensions, same CSS transform) contains only the `<text>` or `<textPath>` elements for segment labels. Both layers rotate together via a shared CSS transform on a wrapper div.
- **Option D — Pure CSS transform with HTML labels.** Each segment as a `<div>` rotated with CSS `transform: rotate()`. Achievable for a small segment count (8–12), impractical for 43 segments due to DOM node overhead and hit-testing complexity.

**Chosen Option:** C — Hybrid Canvas + SVG.

**Rejected Options:** Option A is the current broken state. Option B has animation performance problems. Option D is impractical at 43 segments.

**Reason:** The hybrid approach preserves the existing Canvas animation performance while fixing the only visual weakness: label readability. The SVG overlay adds no significant layout cost because it contains only `<text>` elements and no compositing layers. The rotation transform applies to both layers simultaneously via a wrapper `div`, avoiding any desync between the visual rotation and the label positions.

**Files Affected:**
- `client/src/components/WheelCanvas.tsx` — refactored to expose rotation as CSS transform on a wrapper div; SVG overlay added

**Proof Required:**
- Screenshot of wheel at 375px width showing all visible segment labels are readable (not overlapping, not truncated, correct orientation)
- Frame rate measurement: Chrome DevTools Performance tab, 60fps maintained during full spin on a mid-range device (Moto G Power equivalent or Chrome Throttling: 4x CPU slowdown)
- `pnpm compliance` passes after change

---

## DL-003 — Realtime Event Contract: Fix `"phase_update"` → `"spin_committed"`

| Field | Value |
|-------|-------|
| **Decision ID** | DL-003 |
| **Date** | 2026-06-03 |
| **Decision** | Change `broadcastRoomEvent(room.code, "phase_update", {...})` to `broadcastRoomEvent(room.code, "spin_committed", {...})` at `server/routers.ts` line 320 |
| **Status** | ACCEPTED |

**Context:** The server broadcasts a Supabase Realtime event when a player spins the wheel. This event carries the full deterministic spin payload (`spinId`, `finalAngle`, `spinDurationMs`, `spinStartedAt`, `segmentIndex`, `velocity`) so that passive clients can animate the wheel identically to the active player. During Phase C+D hardening, the client event handler was renamed from `"phase_update"` to `"spin_committed"` to match the `BroadcastEvent` type in gameTypes.ts. However, the server-side `broadcastRoomEvent` call was not updated. The server still broadcasts `"phase_update"` — an event name that no client is listening for.

This means passive players never receive the spin trigger via Realtime. They depend on the 3-second polling fallback, which means they miss both the `spinning` phase and the `landing_closeup` phase entirely in most cases (5s total window, 3s poll interval). They jump directly from "Waiting..." to the result card.

**Options Considered:**

- **Option A — Change server broadcast name to `"spin_committed"` (CHOSEN).** One word change. No schema change, no API change, no database change. The client handler is already correct and waiting.
- **Option B — Change client listener name to `"phase_update"`.** Also one word change. Requires updating `useRoomRealtime.ts` and `RoomBroadcastPayload` type and `Game.tsx` handler. More changes for the same outcome.
- **Option C — Add both event listeners on the client (listen for both `"phase_update"` and `"spin_committed"`).** Belt-and-suspenders approach. Prevents this class of bug from recurring but adds permanent technical debt.
- **Option D — Do nothing, rely on polling.** 3-second polling becomes the primary sync mechanism. Game appears laggy for all passive players. Unacceptable for a party game.

**Chosen Option:** A — Change server broadcast name.

**Rejected Options:** Option B has more file changes for identical outcome. Option C adds permanent dual-handler tech debt. Option D is the current broken state.

**Reason:** The canonical event name `"spin_committed"` is defined in the shared `BroadcastEvent` type union in gameTypes.ts. The server should match the shared type. One word change at one call site is the minimum-risk, highest-leverage fix in the codebase.

**Files Affected:**
- `server/routers.ts` line 320 — `"phase_update"` → `"spin_committed"`

**Proof Required:**
- Multi-client test: two browser sessions, active player spins, passive player's wheel animation fires within 500ms of server broadcast
- `pnpm compliance` passes after change
- Supabase Realtime channel log OR server debug log showing `spin_committed` event delivered

---

## DL-004 — Forced Landscape Strategy

| Field | Value |
|-------|-------|
| **Decision ID** | DL-004 |
| **Date** | 2026-06-03 |
| **Decision** | Enforce landscape orientation in the game view using `OrientationGuard` (screen.orientation.lock + portrait overlay) AND redesign the game layout for a 3-zone landscape studio rather than a responsive mobile stack |
| **Status** | ACCEPTED |

**Context:** AI4U Party Wheel is a shared-stage party game played with physical friends in the same room. The TV/tablet large-screen use case (one device on a table or cast to a TV) is the primary value proposition. The existing Game.tsx layout is a vertically-stacked single column that was designed mobile-first. `OrientationGuard` was added in v14 Phase 6 and correctly locks to landscape, but the layout behind it was not redesigned. The game currently shows a portrait-optimized layout inside a landscape forced frame.

**Options Considered:**

- **Option A — Keep mobile-first portrait layout, use `lg:flex-row` for landscape.** Current approach. Easy to implement but does not create a game-show feel. The wheel and content card appear side by side but without intentional zone design.
- **Option B — Build a 3-zone landscape layout from scratch:** Left zone (player avatars + scoreboard strip), Center stage (wheel + phase content), Right zone (host controls + chat). Forces landscape. Requires DL-001 (GameStageShell) to implement cleanly.
- **Option C — Responsive: support both portrait and landscape equally.** Two distinct layouts, responsive breakpoints. Doubles the visual design surface area. Not aligned with the product vision of a shared-stage party game.
- **Option D — Force landscape only, show "Rotate Device" overlay in portrait (CHOSEN in combination with Option B).** `OrientationGuard` is already implemented. Add the 3-zone layout that takes advantage of the locked landscape orientation.

**Chosen Option:** D (landscape lock via OrientationGuard) + B (3-zone studio layout). These are not in conflict — the lock ensures the 3-zone layout is always rendered correctly.

**Rejected Options:** Option A is the current state which does not match the product vision. Option C doubles visual work for a product that is fundamentally a shared-screen party game.

**Reason:** A party game played on a shared screen belongs in landscape. The 3-zone layout (avatars on the left as spectators, wheel center stage, controls on the right) directly mirrors the physical dynamic of a game show — audience left, action center, host right. This layout cannot be achieved in portrait mode on a phone. Forcing landscape is the right product decision.

**Files Affected:**
- `client/src/components/OrientationGuard.tsx` — keep as-is (already wired)
- `client/src/components/GameStageShell.tsx` — new file, implements 3-zone layout
- `client/src/pages/Game.tsx` or `StageDirector.tsx` — stage area redesigned for landscape

**Proof Required:**
- Screenshot of the 3-zone layout on a 1024×768 viewport (landscape tablet)
- `OrientationGuard` portrait overlay screenshot on a 390×844 viewport (iPhone 14 portrait)
- `pnpm compliance` passes

---

## DL-005 — Content Strategy: Curated Fallback Pack First, AI Generation Second

| Field | Value |
|-------|-------|
| **Decision ID** | DL-005 |
| **Date** | 2026-06-03 |
| **Decision** | The content generation system uses live LLM calls as the primary path with a static `FALLBACK_BANK` as the secondary. The fallback bank must be high-quality and party-game-appropriate, not placeholder content. |
| **Status** | ACCEPTED |

**Context:** Content generation uses `invokeLLM()` for all 9 segment types. When the LLM times out or fails, the `getDefaultContent()` function draws from `FALLBACK_BANK` — a static array of pre-written challenges per segment type. The fallback bank was populated in v7 with adult-party-appropriate content. LLM generation is the aspirational path but introduces latency (1–5 seconds) and cost per spin.

**Options Considered:**

- **Option A — LLM-only, no fallback.** Fails in offline/degraded environments. Every LLM failure produces a blank challenge card.
- **Option B — Static pack only (no LLM).** Zero latency, zero cost, fully predictable. But challenges repeat after a few sessions. No personalization.
- **Option C — LLM primary, static fallback secondary (CHOSEN AND IMPLEMENTED).** LLM generates novel, personalized content for each spin. When it fails, the static fallback ensures gameplay continues. The fallback bank is pre-written by hand to be genuinely funny and party-appropriate (not placeholder text).
- **Option D — Hybrid: pre-generate a session pack of 30 challenges via LLM at game start, serve from cache.** Eliminates per-spin LLM latency but requires a pre-game loading screen and doesn't adapt to mid-game player name personalization.

**Chosen Option:** C — LLM primary, static fallback secondary.

**Rejected Options:** Option A is fragile. Option B is the fallback path, not the primary. Option D adds complexity and a loading screen that would disrupt the party-game flow.

**Reason:** The current implementation is correct. The only gap is that `recordContentUsage()` is not called, so the deduplication system is inactive. The fix is adding one call after the moderation step. The content strategy itself is sound.

**Files Affected:**
- `server/routers.ts` — `generateSegmentContent()` function — add `recordContentUsage()` call
- `server/contentRecency.ts` — infrastructure already exists
- `server/contentLogger.ts` — infrastructure already exists

**Proof Required:**
- `recordContentUsage()` call added and verified in code review
- `pnpm compliance` passes after change
- Manual test: verify that after 10+ spins of the same segment type, content does not repeat within the recency window

---

## DL-006 — Visual Direction: AI4U Neon Game-Show Studio

| Field | Value |
|-------|-------|
| **Decision ID** | DL-006 |
| **Date** | 2026-06-03 |
| **Decision** | The visual language for the game is "neon AI game-show studio": dark space background, OKLCH neon accent colors (violet, cyan, pink, amber), Orbitron display font for labels, glowing UI elements, and a physical stage metaphor with spotlights and depth |
| **Status** | ACCEPTED |

**Context:** The global CSS theme (dark neon AI aesthetic, OKLCH colors, Orbitron/Inter fonts) was established in Phase 1 and is correct. However, the application of this theme is uneven. The age gate, lobby, and several game UI components use generic Tailwind utility classes that do not implement the neon game-show aesthetic. The "TV studio background" (radial gradient + floor grid) was added as a CSS class but is obscured by the stacked card layout. The visual direction is defined but not consistently applied.

**Options Considered:**

- **Option A — Minimal, functional UI. Focus on gameplay mechanics.** Faster to build. Acceptable for a beta/test phase. Does not create the viral "wow factor" that drives social sharing and word-of-mouth.
- **Option B — Full production game-show studio visual (CHOSEN).** Neon spotlights on the stage, contestant podiums with name plates and hype-point counters, a wheel that looks like it belongs on a broadcast set, and dramatic phase transition animations. This is what the product name "Glitch After Dark" implies.
- **Option C — Clean flat design.** Modern SaaS aesthetic. Inconsistent with the "adult party game with AI chaos" positioning.

**Chosen Option:** B — Full neon game-show studio.

**Rejected Options:** Option A is the current state — it does not match the brand. Option C is wrong for the genre.

**Reason:** The name "AI4U Party Wheel: Glitch After Dark" is inherently theatrical. The product's viral potential depends on players wanting to share moments from the game. A screenshot of a neon game-show studio with dramatic lighting and animated segment reveals is shareable. A screenshot of dark-themed utility cards is not. The visual direction is the primary driver of organic growth.

**Files Affected:**
- `client/src/components/AgeGate.tsx` — neon redesign
- `client/src/components/GameStageShell.tsx` — stage background with spotlight effects
- `client/src/components/WheelCanvas.tsx` — enhanced with SVG labels (DL-002)
- `client/src/pages/Game.tsx` or stage components — consistent neon treatment for all phase cards
- `client/src/index.css` — global CSS variables for neon palette already exists; extend

**Proof Required:**
- Screenshots of age gate, lobby, and game screen showing consistent neon game-show aesthetic
- The word "studio" should feel accurate when looking at the game in landscape

---

## DL-007 — Bot Behavior Boundaries

| Field | Value |
|-------|-------|
| **Decision ID** | DL-007 |
| **Date** | 2026-06-03 |
| **Decision** | Bots spin automatically after a delay, send chat quips at defined events, and vote on applicable segment types. Bots do NOT submit truth answers, do NOT submit duel answers, and do NOT simulate human emotions beyond the scripted quip lists. |
| **Status** | ACCEPTED |

**Context:** The bot engine was built in v75 to enable solo play and fill empty rooms. 4 personalities (HYPE_BOT, CHAOS_GREMLIN, ROAST_MASTER, TRIVIA_NERD) each have scripted chatQuips and personality-specific spin delay ranges. The current implementation: bots spin, bots chat, bots send reaction quips. Missing: bot voting on truth_cache and glitch_dare (listed as a todo in v9, not implemented).

**Options Considered:**

- **Option A — Bots are passive spectators only (spin + score tracking, no chat).** Minimal, safe, boring for solo play.
- **Option B — Bots spin + chat (current state).** Functional for solo play. Creates the illusion of opponents. Missing voting creates stuck states on truth/dare.
- **Option C — Bots spin + chat + vote on all applicable segment types (CHOSEN).** Adds bot voting for truth_cache (YES/NO), glitch_dare (PASS/FAIL), braincell_check (CORRECT/WRONG), and holo_drama (YES/NO). Each personality has a voting bias (e.g., CHAOS_GREMLIN votes randomly, HYPE_BOT votes for the human to PASS, ROAST_MASTER votes for FAIL).
- **Option D — Bots also generate AI responses to truth/dare questions.** Requires additional LLM calls per bot. Creates latency. Not worth the complexity for the current product stage.

**Chosen Option:** C — Bots spin + chat + vote on all applicable segment types. Option D is explicitly out of scope.

**Rejected Options:** Option A is too passive. Option B is the current broken state for truth/dare. Option D adds LLM cost and latency with unclear value.

**Reason:** Bot voting is the minimum requirement for solo play to be a complete gameplay loop. Without bot votes, truth_cache and glitch_dare challenges in solo mode never auto-resolve. The host must manually use Force Next Turn — which is a visible acknowledgment that the game is broken. Bot voting with personality bias is simple to implement (a random choice from VOTE_CHOICES[segmentType] with a slight personality skew) and makes solo play feel like a real game.

**Bot Behavior Boundaries (explicit):**
- WILL DO: auto-spin after delay, send chatQuips from scripted list, cast votes with personality bias
- WILL NOT DO: generate LLM responses to challenges, simulate opinions about specific content, impersonate real people or reference real events, send explicit or policy-violating content (all content is from scripted quip arrays, not LLM-generated)

**Files Affected:**
- `client/src/hooks/useBotEngine.ts` — add bot voting logic for truth_cache, glitch_dare, braincell_check, holo_drama
- `shared/gameTypes.ts` — BOT_PERSONALITIES already has personality quips; may add `voteStyle` property (e.g., "chaotic", "supportive", "harsh")

**Proof Required:**
- Solo play session: spin truth_cache, bot auto-votes YES/NO, challenge auto-resolves without manual Force Next Turn
- `pnpm compliance` passes after change

---

## DL-008 — Definition of "Done" for This Rescue Pass

| Field | Value |
|-------|-------|
| **Decision ID** | DL-008 |
| **Date** | 2026-06-03 |
| **Decision** | The V2 Rescue pass is DONE when: (a) the event name bug is fixed and code-verified, (b) `pnpm compliance` passes, (c) a Daedalus Gate Receipt is issued, and (d) multi-client sync is either E2E-proven or explicitly acknowledged as DEGRADED_SUCCESS with documented limitation |
| **Status** | ACCEPTED |

**Context:** Prior passes have used "done" loosely — phases were marked `[x]` when code was written but the feature was untested or deferred. This created a growing gap between the todo.md checked state and the actual functional state. The rescue pass must apply a stricter definition.

**Tiers of "Done":**

**DONE (VERIFIED_SUCCESS):**
- All 56 unit tests pass (`pnpm compliance` exits 0)
- 0 TypeScript errors (`pnpm check` exits 0)
- The fixed bug (DL-003 event name) is verified by a multi-client test (two browser sessions, one spins, the other animates) OR by a Supabase Realtime log showing the event delivered to a subscriber
- A Daedalus Gate Receipt is issued and signed with verdict VERIFIED_SUCCESS
- Screenshots exist for any visual changes

**DONE (DEGRADED_SUCCESS):**
- All 56 unit tests pass
- 0 TypeScript errors
- The fixed bug is code-verified (one-word change at the correct line, correct event name in the correct place)
- A Daedalus Gate Receipt is issued with verdict DEGRADED_SUCCESS
- Limitation noted: "Multi-client sync not runtime-verified. Event name fix is correct by code inspection but not proven by simultaneous browser session test."
- No screenshots captured (visual phases deferred)

**NOT DONE:**
- Any phase where `pnpm compliance` fails
- Any phase where `pnpm check` has TS errors
- Any phase where a feature is marked `[x]` in todo.md but the feature has a known broken behavior
- Any phase where the Daedalus Gate Receipt is not issued

**Options Considered:**

- **Option A — "Done = code written and committed."** The current historical standard. Led to the spin_committed event name mismatch being marked done when it was broken.
- **Option B — "Done = pnpm compliance passes."** Better than A. Still allows visual features to be marked done without proof.
- **Option C — "Done = compliance + proof artifacts (screenshots / test results / Daedalus receipt)."** The rescue pass standard (CHOSEN).

**Chosen Option:** C — compliance + proof artifacts.

**Rejected Options:** Option A is explicitly rejected — it is the standard that produced the current broken state. Option B is a necessary but not sufficient condition.

**Reason:** The purpose of this ledger is to prevent the gap between "written" and "working" from growing. Requiring proof artifacts forces verification at the time of completion rather than trusting code inspection alone. The Daedalus Gate Receipt pattern (see docs/proof/DAEDALUS_GATE_RECEIPT_V2_RESCUE.md) provides a consistent receipt format.

**Files Affected:**
- `docs/proof/DAEDALUS_GATE_RECEIPT_V2_RESCUE.md` — must be completed before marking the rescue pass done
- `todo.md` — new phases added by the rescue pass must use this DoD before being checked

**Proof Required for This Entry:**
- This entry IS the proof definition. No further proof required.

---

*Decision Ledger maintained. All entries status: ACCEPTED. New decisions in future sessions should be appended as DL-009, DL-010, etc.*
