# AI4U Mission Runner Intent Optimization — Integration Receipt

## Scope
This release introduces an opt-in goal-optimization stage ahead of the existing HTTPS website audit. It does **not** expand the supported executable workflow beyond public HTTPS homepage readiness. It does **not** execute plans automatically.

### User path
1. Sign in under Settings/Billing.
2. Open Mission Runner, type goal, select **Improve My Goal**.
3. Review suggested wording, fastest and thorough alternatives, or keep original.
4. Optional: inspect typed steps and their success checks.
5. Select **Save This Plan to My Account**; server recomputes the proposal and validates the selected option.
6. Select **Resume Saved Plan** after refresh or sign-in on another device. Latest saved plan is retrieved by owner-authenticated API.
7. For an eligible public HTTPS homepage, continue to the unchanged Website Launch Readiness pilot below.

### Persistence
- Server-side authenticated API: `/api/mission/site-audit?intent=1` (shared endpoint to avoid Vercel Hobby's 12-function ceiling).
- Pure planner: `lib/mission/intent-planner.js`.
- Server handler: `lib/mission/intent-handler.js`.
- Private Supabase-backed Postgres table: `ai4u_private.router_mission_plans`.
- Fields: owner UUID, original goal, server-generated chosen prompt, choice ID, typed plan JSON, timestamps.
- Table created idempotently via the existing `lib/billing/db.js` server schema initializer. It is not exposed through Supabase Data API; public table privileges are revoked.
- Owner check on all reads and writes; no client-side durable copy of user goals.
- History retained; Resume returns the most recently saved record.
- Database creation and authenticated live persistence must be validated against production using a real signed-in test account. A passing mocked unit test does not establish live DB writes.

### Product safety
- All planner alternatives are suggestions; no silent text substitution.
- An edited goal invalidates stale suggestions.
- Ambiguous goals cannot be saved until clarified (enforced on server).
- No tool calls, payment, sending, deletion or publishing are performed by this planner.
- Current V2 Signed Proof Pack cryptographic handling is untouched.
- Release/rollback: GitHub PR, GitHub Actions quality + billing checks, Vercel READY preview; revert the PR commit if the live canary fails. Do not discard saved user plans.

### Remaining follow-up
- Sign-in canary: preview/save/resume as account A, ensure account B cannot see account A's plan, verify SQL rows in private storage.
- Browser smoke: desktop+mobile, keyboard operation, refreshing after save, clarity after changing a goal.
- Rich semantic intent adapter with an independently evaluated model and budget caps.
- Persisted plan-to-execution link for future universal mission types; existing website audit remains separate.
- Formal deletion/export and retention lifecycle (#21).
