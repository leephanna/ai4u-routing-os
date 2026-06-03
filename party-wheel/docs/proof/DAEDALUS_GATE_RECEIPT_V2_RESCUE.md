# Daedalus Gate Receipt — AI4U Party Wheel V2 Rescue

**Receipt type:** Pre-build gate (issued before build, to be updated after completion)
**Issued by:** Claude Code Agent (Daedalus Verifier / Agent C)
**Date issued:** 2026-06-03T00:00:00Z
**Build session:** V2 Rescue Pass

---

## Repository Information

| Field | Value |
|-------|-------|
| **Repo name** | leephanna/ai4u-routing-os |
| **Working directory** | `/home/user/ai4u-routing-os/party-wheel/` |
| **Build timestamp** | 2026-06-03T00:00:00Z (placeholder — update after commit) |
| **Branch** | `claude/magical-fermat-ozmkn` |
| **Commit hash** | PENDING (update after `git commit`) |
| **Base commit** | Run `git log --oneline -5` to capture baseline |

---

## Build Scope

This receipt covers the V2 Rescue Pass for the AI4U Party Wheel game. The rescue pass addresses:

1. **Critical** — Realtime event contract mismatch (`"phase_update"` → `"spin_committed"`)
2. **High** — `landing_closeup` phase not handled in passive client Realtime handler
3. **Medium** — `recordContentUsage()` call site missing (content deduplication inactive)
4. **High** — Game.tsx visual layer extraction (GameStageShell + StageDirector)
5. **High** — SVG hybrid wheel for readable segment labels
6. **Medium** — Cinematic phase transitions wired for all clients
7. **Low** — Visual polish (age gate, podiums, spin button broadcast state)
8. **Medium** — Bot voting for truth_cache / glitch_dare in solo play

---

## Files Changed in This Rescue Pass

The following files are expected to be changed. Update this list with actual files after build completes.

### Server-Side Changes
- `server/routers.ts`
  - Line 320: `"phase_update"` → `"spin_committed"` (DL-003, CRITICAL FIX)
  - `generateSegmentContent()`: add `recordContentUsage()` call after `logGeneratedContent()` (DL-005)
  - Add `// TODO(crash-safety): Replace setTimeout phase advance with a crash-safe mechanism (e.g., scheduled DB polling) before production at scale` comment at line 395

### Client-Side Changes
- `client/src/pages/Game.tsx`
  - Add `landing_closeup` handler in `handleRoomUpdate` case `"room_update"`
  - Extract business logic to `useGameState` hook or equivalent (DL-001)
  - Wire bot voting for truth_cache / glitch_dare (DL-007)
- `client/src/hooks/useRoomRealtime.ts`
  - No change needed (client already listens for `"spin_committed"` — correct)
- `client/src/components/WheelCanvas.tsx`
  - Add SVG overlay layer for segment labels (DL-002)
  - Wrap Canvas + SVG in a shared `div` with CSS transform for rotation
- `client/src/components/AgeGate.tsx`
  - Neon visual redesign (DL-006)
- `client/src/hooks/useBotEngine.ts`
  - Add bot voting for truth_cache, glitch_dare, braincell_check, holo_drama (DL-007)

### New Files Created
- `client/src/components/GameStageShell.tsx` — 3-zone landscape layout (DL-001, DL-004)
- `client/src/components/StageDirector.tsx` — phase → component router (DL-001)
- `docs/proof/current-state-audit-v2-rescue.md` — this audit (written, present)
- `docs/proof/harmonia-consensus-v2-rescue.md` — consensus document (written, present)
- `docs/decision-ledger/AI4U_PARTY_WHEEL_DECISION_LEDGER.md` — decision ledger (written, present)
- `docs/proof/DAEDALUS_GATE_RECEIPT_V2_RESCUE.md` — this receipt (written, present)

### Optional New Files (if Phase 5+ completes)
- `client/src/stages/WheelStage.tsx`
- `client/src/stages/LandingStage.tsx`
- `client/src/stages/ResultStage.tsx`
- `client/src/stages/VotingStage.tsx`
- `client/src/stages/ChallengeStage.tsx`
- `client/src/stages/GameOverStage.tsx`

---

## Commands to Run

Run these commands in order after each phase of the build. All must exit 0 before a phase is marked complete.

```bash
# TypeScript type check — must show 0 errors
pnpm check

# Full test suite (vitest) — must show 56/56 passing
pnpm test

# Compliance gate (runs both above) — primary CI gate
pnpm compliance

# Content generation integration test (run manually — requires LLM API keys)
# Expected: generates content for all 9 segment types × 3 intensity tiers, no errors
pnpm content
# NOTE: "pnpm content" does not exist yet — this is a future script to add

# End-to-end multi-client sync test (requires live server + Playwright)
# Expected: two browser sessions, player 1 spins, player 2 sees animation within 500ms
pnpm e2e
# NOTE: "pnpm e2e" does not exist yet — Playwright tests are a future phase
```

**Current scripts in package.json (verified):**
```json
"check": "tsc --noEmit",
"test": "vitest run",
"compliance": "pnpm check && pnpm test",
"eval:live": "pnpm test -- --reporter=verbose"
```

---

## Phase-by-Phase Compliance Checkpoints

| Phase | Description | pnpm check | pnpm test | Additional Proof |
|-------|-------------|------------|-----------|-----------------|
| Phase 1 | Fix `"phase_update"` → `"spin_committed"` | PENDING | PENDING | Code diff showing single-word change at routers.ts:320 |
| Phase 2 | Handle `landing_closeup` in passive client | PENDING | PENDING | Manual test: passive player enters landing animation |
| Phase 3 | Add `recordContentUsage()` call | PENDING | PENDING | Code diff showing call added after logGeneratedContent() |
| Phase 4 | handleRoomUpdate completeness audit | N/A (docs only) | N/A | Gap analysis document |
| Phase 5 | GameStageShell + StageDirector | PENDING | PENDING | Screenshot: 3-zone layout at 1024×768 |
| Phase 6 | SVG hybrid wheel | PENDING | PENDING | Screenshot: readable labels at 375px; frame rate ≥60fps |
| Phase 7 | Cinematic transitions for all clients | PENDING | PENDING | Screenshot: landing animation on passive client |
| Phase 8 | Visual polish | PENDING | PENDING | Screenshots: age gate, podiums |
| Phase 9 | Proof pass | PENDING | PENDING | Multi-client test OR DEGRADED_SUCCESS note |

---

## Known Limitations

The following limitations are known at time of receipt issuance. They do NOT block DEGRADED_SUCCESS but DO block VERIFIED_SUCCESS.

### Limitation 1 — No Playwright E2E Tests (Multi-Client Sync Not Automated)

**Scope:** The `pnpm e2e` command does not exist. There are no Playwright or Cypress tests that open two simultaneous browser sessions, join the same room, and verify synchronized state transitions.

**Impact:** The most critical bug fix in this pass (the `"spin_committed"` event name fix) cannot be automatically proven in CI. It can be code-verified (the change is at the correct call site, the client handler is already correct) but not runtime-verified without a live server and two browser sessions.

**Workaround for DEGRADED_SUCCESS:** Manual test procedure — open two browser tabs, join the same room, have the active player spin, confirm the passive player's wheel animates. Document with timestamp.

**Path to VERIFIED_SUCCESS:** Write a Playwright test using `browser.newContext()` to open two sessions. Assert that within 500ms of the spin mutation completing on the active player's tab, the passive player's tab shows the spinning phase via DOM state change.

### Limitation 2 — LLM API Keys Required for Content Generation Tests

**Scope:** The content generation system calls `invokeLLM()` which requires a valid OpenAI-compatible API key set in the environment. Unit tests mock or skip the LLM call. Manual testing of content variety, moderation filtering, and recency deduplication requires live API keys.

**Impact:** `recordContentUsage()` fix (Phase 3) cannot be end-to-end verified without API keys. Code verification is sufficient for the unit test gate.

### Limitation 3 — `setTimeout` Phase Advance Is Not Crash-Safe

**Scope:** The auto-advance from `landing_closeup` to the next phase uses `setTimeout` in the Node.js process (routers.ts line 395). This timer is not persisted to the database.

**Impact:** A server restart or deploy during the 5-second `landing_closeup` window leaves the room permanently stuck. This is a known architectural limitation that is NOT resolved in this rescue pass.

**Mitigation in this pass:** A `// TODO(crash-safety):` comment is added at the relevant line. Recovery path is `game.resetPhase` (host action). This limitation must be resolved before production at scale.

### Limitation 4 — Bot Voting for Truth/Dare Requires Live Game Test

**Scope:** Bot voting additions in `useBotEngine.ts` cannot be fully unit-tested without simulating the Realtime event loop. The voting logic can be unit-tested at the mutation level (server-side), but the full flow (bot observes phase change → bot casts vote → voting auto-resolves → result displayed) requires a live game session.

**Impact:** Bot voting may be code-correct but have timing or state issues that only appear in a live solo session. Manual QA required.

### Limitation 5 — Visual Phases (Phase 5–9) Are Scope-Conditional

**Scope:** GameStageShell, StageDirector, SVG wheel, cinematic transitions, and visual polish are scoped to this rescue pass but are not required for minimum-viable-rescue. If time constraints prevent completion of Phase 5+, the rescue pass ships as DEGRADED_SUCCESS with the architectural refactor and visual work deferred to the next session.

**Impact:** The visual experience will remain "boxes on dark background" rather than "neon game-show studio" if Phase 5–9 are not completed. The game mechanics will be correct but the visual experience will not match the DL-006 visual direction.

---

## Final Verdict

| Field | Value |
|-------|-------|
| **Pre-build verdict** | NOT_PROVEN |
| **Post-build verdict** | PENDING (update after build and test run) |
| **pnpm compliance result** | PENDING |
| **Multi-client proof** | PENDING |
| **Visual phases completed** | PENDING |

### Verdict Definitions

**VERIFIED_SUCCESS:** All 56 tests pass, 0 TS errors, multi-client sync proven (automated or manual with evidence), Phase 1 fix deployed.

**DEGRADED_SUCCESS:** All 56 tests pass, 0 TS errors, Phase 1 fix is code-verified (correct single-word change at routers.ts:320), multi-client runtime proof not available but limitation is explicitly documented.

**NOT_PROVEN:** Tests fail, TS errors present, or Phase 1 fix not confirmed in code.

**FAILED:** Tests regression from 56 passing, or TS errors introduced, or Phase 1 fix is incorrect/reverted.

---

## Acceptance Criteria Summary

The V2 Rescue Pass is accepted when the following are ALL true:

- [ ] `pnpm compliance` exits 0 with output showing 56/56 tests passing
- [ ] `pnpm check` exits 0 with `Found 0 errors.`
- [ ] `server/routers.ts` line 320 reads `broadcastRoomEvent(room.code, "spin_committed", {` (not `"phase_update"`)
- [ ] `generateSegmentContent()` in routers.ts calls `recordContentUsage()` after `logGeneratedContent()`
- [ ] A `// TODO(crash-safety):` comment exists at the `setTimeout` block (routers.ts ~line 392)
- [ ] This receipt's "Post-build verdict" is updated from PENDING to VERIFIED_SUCCESS or DEGRADED_SUCCESS
- [ ] Commit hash is recorded in this receipt

---

## Signature

**Agent C (Daedalus Verifier):** Receipt issued. Build may proceed.

All outstanding items are marked PENDING. This receipt must be updated and re-signed after the build completes. Any item that remains PENDING at the time of final delivery means the rescue pass did not reach VERIFIED_SUCCESS status.

*"Proof is not what you intended to build. Proof is what you can show actually works."*

---

*Receipt issued: 2026-06-03T00:00:00Z*
*Receipt status: PRE-BUILD (update to POST-BUILD after commit)*
