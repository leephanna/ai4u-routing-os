# Durable Guided Execution Engine — P1 Storefront Checkpoint

## Architecture and trust boundary
- Reuse authenticated `/api/mission/site-audit?guided=1` (existing Vercel serverless function; no new Hobby function).
- `ai4u_private.router_guided_missions`: owner UUID, original saved plan FK, version/revision, current checkpoint, user-reported choices. One row per owner+saved plan.
- `ai4u_private.router_guided_events`: immutable event append per confirmed transition; unique `(guided_mission_id,request_id)` for idempotency. The user-visible state row and event append are one DB transaction.
- Both tables are in the non-exposed private schema with table privileges revoked for PUBLIC. All queries use authenticated user IDs and parameterized SQL.
- The DB schema is initialized through the existing server-owned `ensureSchema` lifecycle; a live database query is required to prove production persistence.

## User flow
1. Save an optimized storefront goal in Mission Runner.
2. From Prompt Gen or Mission Runner, choose **Start Guided Mission**.
3. The app retrieves the most recently saved plan, starts/resumes a single guided mission, and displays **DO THIS NEXT**: confirm region, fulfillment mode, and approximate monthly budget. Each allows **Not sure**.
4. Confirm Step 1. The server atomically changes state to `awaiting_route_review`, records `user_confirmed` evidence with a unique request key, and increments revision.
5. The client performs readback verification before showing confirmation.
6. On refresh or another device, **Resume Guided Step** reads the server record and displays its current checkpoint.

## Definition of Done, scope, and limitations
- Tests must cover owner isolation, idempotent retry, stale revision rejection, invalid inputs, and guided UI integration; CI green, Vercel preview READY.
- Explicit success is **requirements saved / user-confirmed**, not externally verified.
- Step 2 requires an evidence-supported comparison of platform pricing/shipping/payments before it can advance. It is **deliberately not executable in P1**.
- No external automation, payment, posting, website creation, pricing commitment, or signed Proof Pack claim.
- No new paid service; rollback = revert reviewed PR without deleting database rows.
- Real authenticated cross-device canary is still required after release; unit tests alone do not prove DB writes.

## Follow-up development
- Phase 2: grounded comparison of viable store platforms with current pricing and shipping; versioned route decision and explicit alternative approval.
- Phase 3: authorized Wix/store setup actions, test checkout, photos/product catalog, shipping, and evidence receipts.
- Phase 4: cross-mission generalized state machine, durable execution, retry recovery, proof integration, human satisfaction.
