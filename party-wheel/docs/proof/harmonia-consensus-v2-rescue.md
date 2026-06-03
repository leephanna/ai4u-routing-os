# Harmonia 3-Agent Consensus Document — AI4U Party Wheel V2 Rescue

**Document type:** Multi-agent consensus record
**Date:** 2026-06-03
**Session:** V2 Rescue Pass
**Branch:** claude/magical-fermat-ozmkn
**Agents convened:**
- **Agent A — Product/Game Director:** Focused on viral party-game experience, player delight, visual direction, and launch readiness
- **Agent B — Systems/Realtime Engineer:** Focused on sync contract correctness, server authority, crash safety, and testability
- **Agent C — QA/Daedalus Verifier:** Focused on proof artifacts, no fake "done," screenshot evidence, test coverage, and definition of done

---

## Problem Summary

The AI4U Party Wheel game has a working server, 56 passing tests, and a functional tRPC API. It has been through 15+ named development passes and accumulated substantial code. However, there is a single critical realtime event name mismatch that silently breaks the shared-stage experience for every non-active player on every spin: the server broadcasts `"phase_update"` but the client listens for `"spin_committed"`. This means passive players never see the wheel spin in real time. They see the result card appear as if by teleportation.

Compounding this, the visual layer has not been redesigned despite multiple plans to do so. Game.tsx is 1,292 lines of mixed concerns. The landscape layout was deferred. Cinematic transitions were deferred. The wheel label density makes segments illegible at mobile scale. The content deduplication system exists but is never called.

The V2 Rescue pass must fix the event contract, redesign the visual layer, and deliver proof that the shared experience actually works.

---

## Top 10 Risks

1. **Event name fix triggers regression in existing Realtime tests.** The `supabase.realtime` test file mocks or tests specific event names. Changing `"phase_update"` to `"spin_committed"` must not silently break the existing test assertions. (Agent B ranked this #1 risk.)

2. **Game.tsx refactor breaks phase reconciliation.** The phase reconciliation `useEffect` that handles reconnection is embedded in Game.tsx. If the rescue pass restructures Game.tsx without carefully porting this logic, late-joining players may see blank screens or wrong phase.

3. **GameStageShell introduces new render tree that loses component state.** If `StageDirector` or `GameStageShell` unmounts and remounts child components during phase transitions (rather than conditionally showing/hiding), React state within those children (e.g., vote timer, countdown refs) will be lost.

4. **SVG hybrid wheel has mobile performance regression.** Adding an SVG overlay to a Canvas animation layer adds DOM nodes and compositing cost. On low-end Android devices common at parties (Galaxy A-series), this could cause dropped frames during the spin animation.

5. **`landing_closeup` phase timing is still not wired for passive clients.** Even after fixing the event name, passive clients receive `spin_committed` and start spinning. But the 5-second `landing_closeup` server timeout is still not communicated to the client in a way that drives a distinct zoomed-pointer animation. The `spinning` → `landing_closeup` server transition requires the client to know when to switch from "wheel spinning" to "wheel slowing + pointer zooming."

6. **Server `setTimeout` phase advance is not crash-safe.** An in-process timer cannot survive a server restart. During the rescue pass, if the server is restarted (e.g., during deployment), any active `landing_closeup` window will hang. This is a known risk that is NOT addressed by the rescue pass and must be documented.

7. **`recordContentUsage()` call site may introduce performance regression.** The deduplication system was designed but not profiled. Adding the call in the hot path of `generateSegmentContent()` (which is already awaiting an LLM call) adds negligible async overhead — but the in-memory store's `hasContentBeenUsedRecently()` scan over 50 items per room could theoretically grow if room IDs are not cleaned up.

8. **Bot voting not implemented for truth_cache / glitch_dare.** In solo play — the most common path for new users — truth and dare challenges will not auto-resolve via bot votes. The host must manually advance. This is a known product gap that creates friction in the demo path.

9. **Playwright E2E tests require a live server and two browser windows.** The `pnpm e2e` command does not exist yet. Writing multi-client E2E tests is scoped as a future gate. Any claim that the V2 Rescue "fixes multi-client sync" cannot be VERIFIED_SUCCESS without multi-client proof. At best we reach DEGRADED_SUCCESS with manual testing documented.

10. **Visual redesign scope creep risk.** Redesigning Game.tsx, building GameStageShell, and implementing StageDirector is a large surface area. Agent A wants the full 3-zone studio. Agent B wants a minimal targeted fix (just event name + phase handler). Agent C requires proof for any claim made. Scope must be explicitly bounded before build begins.

---

## Consensus Route

After full deliberation, all three agents agree on the following approach:

**The rescue pass is structured as a layered build where each phase is independently testable and can be shipped if time runs out.**

**Phase 1 — Single-Line Critical Fix (event name):** Change `"phase_update"` to `"spin_committed"` at routers.ts:320. This is the minimum viable rescue. Everything else is improvement on top of a working foundation.

**Phase 2 — `landing_closeup` Passive Client Handler:** Add `currentPhase === "landing_closeup"` handling to Game.tsx's `handleRoomUpdate` `case "room_update"`. Passive clients should enter a local `"landing"` phase (wheel slowing animation, pointer zoom) when they receive this update.

**Phase 3 — `recordContentUsage()` Call Site:** Add the missing call in `generateSegmentContent()`. One line. Activates the deduplication system.

**Phase 4 — `handleRoomUpdate` Completeness Audit:** Verify all server `room_update` payloads have corresponding client handlers. Document any gaps without necessarily fixing them all.

**Phase 5 — GameStageShell + StageDirector Architecture:** Extract visual layer from Game.tsx. Build `GameStageShell` as the 3-zone landscape layout shell. Build `StageDirector` as the phase-to-component router. Port ALL existing business logic and effects from Game.tsx intact before touching visuals.

**Phase 6 — SVG Hybrid Wheel:** Implement the Canvas + SVG overlay approach for readable segment labels. The Canvas handles rotation, the SVG handles text rendering. Gated on Phase 5 (needs the new GameStageShell to position the wheel correctly).

**Phase 7 — Cinematic Phase Transitions:** Wire the existing `LANDING_KEYFRAMES` CSS to the correct phase transitions in `StageDirector`. Landing animation fires during `landing_closeup` for ALL clients, not just the active one. Gated on Phase 5.

**Phase 8 — Visual Polish:** Age gate neon redesign, podium layout in landscape, spin button broadcast state, intensity visual differentiation. Gated on Phase 5.

**Phase 9 — Proof Pass:** Write or document multi-client test procedure. Capture screenshots. Run `pnpm compliance`. Generate DAEDALUS_GATE_RECEIPT. Update this document with final confidence score.

---

## Dissenting Concerns (Agent B — Systems/Realtime Engineer)

Agent B registered the following dissents during deliberation. They are recorded here for completeness.

**Dissent 1 — Phase 5 scope risk:** "Extracting Game.tsx into GameStageShell + StageDirector is a significant refactor on a 1,292-line file with multiple interacting effects. The phase reconciliation effect, the bot engine wiring, the vote timer, the `isMyTurnRef` update, the `animateSpinRef`, the `voteTimerRef`, and the `spinAnimRef` are all tightly coupled. Moving these without full E2E coverage is high risk. My recommendation: fix Phase 1–4, ship that, then tackle Phase 5 in a separate session with explicit E2E test coverage first."

**Dissent 2 — SVG hybrid performance gate:** "Before shipping the SVG hybrid wheel on mobile, we need a performance measurement on a mid-range Android device. Canvas2D rotation at 60fps with an SVG overlay is fine on desktop but may cause compositing issues on devices with limited GPU memory. I want a frame-rate measurement before this ships to production."

**Dissent 3 — `setTimeout` crash safety is undocumented tech debt:** "The `setTimeout` for landing_closeup auto-advance has been in the codebase since v14. Every time a new developer works on this code, this is a trap. Even if we don't fix it in this pass, it needs a TODO comment with a note: 'Replace with a server-side scheduled event or polling-based fallback before production at scale.'"

Agent A acknowledged Dissent 1 and agreed Phase 5–9 are second-tier (to be completed if time allows, not a blocker for merge). Dissent 2 is accepted as a gate condition for Phase 6. Dissent 3 is accepted: a `// TODO(crash-safety):` comment will be added to the setTimeout block.

Agent C noted: "Phase 1 alone, if shipped and verified with multi-client proof, changes the outcome from 'broken party game' to 'working party game.' Phases 2–9 make it excellent. Phase 1 makes it honest."

---

## Final Build Order

```
Phase 1  — Fix "phase_update" → "spin_committed" in routers.ts:320          [CRITICAL, 1 line]
Phase 2  — Handle "landing_closeup" in passive client handleRoomUpdate       [HIGH, ~15 lines]
Phase 3  — Add recordContentUsage() call in generateSegmentContent()         [MEDIUM, 1 line]
Phase 4  — Audit handleRoomUpdate completeness, document gaps                [MEDIUM, no-code]
Phase 5  — GameStageShell + StageDirector extraction from Game.tsx           [HIGH EFFORT]
Phase 6  — SVG hybrid wheel (canvas rotation + SVG labels)                   [HIGH EFFORT]
Phase 7  — Wire cinematic transitions to landing_closeup for all clients     [MEDIUM EFFORT]
Phase 8  — Visual polish (age gate, podiums, spin button broadcast state)    [LOW EFFORT each]
Phase 9  — Proof pass (screenshots, multi-client test, compliance gate)      [REQUIRED for VERIFIED_SUCCESS]
```

Phases 1–4 are the **minimum viable rescue** — they fix correctness without architectural changes. Phases 5–9 deliver the full game-show visual experience and proof artifacts.

---

## Confidence Score

**Current (before rescue pass):** 3/10
- Server logic: 9/10 (solid)
- Realtime sync: 1/10 (broken by event name bug)
- Visual polish: 3/10 (functional but not game-show quality)
- Test coverage: 6/10 (56 server/unit tests, no multi-client E2E)
- Proof: 2/10 (no screenshot artifacts, no multi-client verification)

**After Phase 1–4 (minimum rescue):** 6/10
- Server logic: 9/10 (unchanged)
- Realtime sync: 8/10 (fixed, but still no E2E proof)
- Visual polish: 3/10 (unchanged)
- Test coverage: 7/10 (recordContentUsage activated, gap audit documented)
- Proof: 4/10 (audit documents findings, no screenshots yet)

**After Phase 1–9 (full rescue):** 8.5/10
- Server logic: 9/10 (unchanged + TODO comment on setTimeout)
- Realtime sync: 9/10 (fixed + passive client handler + documented gaps)
- Visual polish: 8/10 (3-zone layout, SVG wheel, cinematic transitions)
- Test coverage: 8/10 (compliance passes + multi-client test procedure documented)
- Proof: 8/10 (screenshots captured, Daedalus receipt issued)

The remaining 1.5 points require: Playwright multi-client E2E (true automated proof of sync), bot voting for truth/dare, and `setTimeout` replacement with a crash-safe mechanism.

---

## What Must NOT Be Changed

These constraints are non-negotiable across all three agents:

1. **Server routers must not change in behavior** — only the `"phase_update"` → `"spin_committed"` event name change at line 320 is authorized on the server side for Phase 1. No new endpoints, no schema changes, no phase transition logic changes.
2. **All 56 unit tests must continue to pass** (`pnpm compliance` exits 0) after every phase.
3. **TypeScript strict mode must remain at 0 errors** (`pnpm check` exits 0) after every phase.
4. **`VOTE_CHOICES` server validation must not be removed or weakened** — this is a security boundary.
5. **`useRoomRealtime` hook architecture must not be replaced** — the channel ref + onUpdateRef pattern is correct; only the event name registration (`"spin_committed"` is already correct on the client).
6. **`buildWheelSegments()` and the 43-segment distribution must not change** — server-side `angleToSegmentIndex()` math depends on `segmentCount = 43`.
7. **Guest session system must not be broken** — `guestSessionId`, cookie, `myPlayerId` server resolution.
8. **Phase reconciliation `useEffect` in Game.tsx must be preserved** — it is the reconnection safety net.
9. **Bot engine (`useBotEngine`, `BOT_PERSONALITIES`)** must remain functional throughout the refactor.
10. **`contentLogger.ts` and `contentRecency.ts` infrastructure** must not be deleted — the infrastructure is correct, only the call site was missing.

---

## What Counts as Proof

For the V2 Rescue pass, Agent C (Daedalus Verifier) requires the following evidence before issuing VERIFIED_SUCCESS status:

1. **`pnpm compliance` passes with output:** All tests listed, exit code 0, after every phase.
2. **`pnpm check` passes with output:** `Found 0 errors.` after every phase.
3. **Event name fix screenshot or log:** Server log showing `broadcastRoomEvent(code, "spin_committed", {...})` firing, OR a Supabase Realtime channel log showing the `spin_committed` event delivered to subscribers.
4. **Multi-client sync proof:** Either (a) a Playwright test that opens two browser sessions in the same room, active player spins, and asserts the passive player's wheel animation fires within 500ms — OR (b) a manual test procedure document with timestamped screen recordings from two devices.
5. **Visual proof:** Screenshots of Game.tsx in landscape mode showing the 3-zone layout (if Phase 5 is completed). Screenshots of the SVG wheel with readable labels (if Phase 6 is completed).
6. **Daedalus Gate Receipt:** A completed `DAEDALUS_GATE_RECEIPT_V2_RESCUE.md` with final verdict field updated from `NOT_PROVEN` to `VERIFIED_SUCCESS` or `DEGRADED_SUCCESS` with explicit scope limitations noted.

If multi-client proof (item 4) is not available, the final verdict must be `DEGRADED_SUCCESS` with the limitation noted: "Event name fix is code-verified but not runtime-verified across two simultaneous clients."

---

*Harmonia consensus recorded. All three agents have signed off on the build order and constraints. Phase 1 is authorized to begin immediately.*
