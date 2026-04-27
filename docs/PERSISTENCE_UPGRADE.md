# AI4U Routing OS — Persistence Upgrade: V3 → V4

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Static Browser (Vercel CDN)                        │
│                                                     │
│  index.html                                         │
│    ├── chart.js (CDN)                               │
│    ├── @supabase/supabase-js (CDN)                  │
│    ├── supabase-config.js (gitignored, optional)    │
│    └── supabase-persistence.js  → window.AI4U_SB   │
│                                                     │
│  Write path:                                        │
│    1. localStorage (synchronous, always)            │
│    2. Supabase insert (async, if signed in)         │
│    3. On failure → mark sync_failed → retry later   │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS (anon key + JWT)
                         ▼
┌─────────────────────────────────────────────────────┐
│  Supabase Project                                   │
│                                                     │
│  Auth:                                              │
│    email/password or magic link (OTP)               │
│    JWT issued to browser — refreshed automatically  │
│                                                     │
│  Postgres (7 tables, RLS enabled):                  │
│    route_decisions    outcome_logs    proof_receipts │
│    success_patterns   failure_rules   artifact_links│
│    routing_settings                                 │
└─────────────────────────────────────────────────────┘
```

---

## Data Model

### `route_decisions`
Every routing decision from the Route Engine. Captures the stage, risk, goal, selected platform, why it was selected, and the generated prompt.

### `proof_receipts`
Proof artifacts saved from the Proof Chain panel. Linked to a `route_decision`. Includes proof type, URL, notes, and verification timestamp.

### `outcome_logs`
The core learning record. One row per task outcome (worked / partial / failed). Powers the Learning Intelligence statistics. Linked to a `route_decision`.

### `success_patterns`
Auto-created from `outcome_logs` when outcome = `worked` and a framework is recorded. Stores the reusable framework for future routing.

### `failure_rules`
Auto-created from `outcome_logs` when outcome = `failed` and a framework/avoidance rule is recorded. Prevents repeating known failure patterns.

### `artifact_links`
Links to live outputs (URLs, repos, screenshots). Created automatically when an outcome log includes an artifact URL.

### `routing_settings`
One row per user. Stores preferences (default platform, default risk, owner name, organization).

---

## RLS Explanation

Row Level Security (RLS) is enabled on all 7 tables. Every table has 4 policies:

- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

This means:
- A user can only read their own records
- A user can only write records that belong to them
- Even if the anon key is exposed, no user can read another user's data
- The service_role key is never used in frontend code

---

## Local Fallback Strategy

Every write operation follows this order:

1. **Write to localStorage** (synchronous, immediate) — entry gets `sync_status: 'local_only'`
2. **Attempt Supabase insert** (async) — if signed in
3. **On success**: update `sync_status = 'synced'`, store `remote_id`
4. **On failure**: update `sync_status = 'sync_failed'`

The `Sync Now` button retries all entries where `sync_status !== 'synced'`.

The `Migrate Local Ledger` button marks all entries as `local_only` then runs Sync Now, pushing everything to Supabase.

---

## Sync Strategy

### Automatic sync
- Triggered on every `addLogEntry()` call when signed in
- Triggered on every `saveRouteDecisionToSB()` call when signed in

### Manual sync
- `Sync Now` button: retries failed/local records
- `Migrate Local Ledger` button: pushes all local records

### Auth state sync
- On sign-in: `onAuthStateChange` fires → `refreshIntelligence()` is called
- On sign-out: status UI updates, ledger banner reverts to local mode

### Cross-device sync
- User signs in on Device B
- `AI4U_SB.init()` runs → `getSession()` restores JWT
- All Supabase queries return that user's records
- New writes on Device B are immediately persisted and visible on Device A after refresh

---

## Config Resolution Order

`supabase-persistence.js` resolves config in this order:

1. `window.AI4U_SUPABASE_CONFIG` — set by `supabase-config.js` (file-based, gitignored)
2. `localStorage['ai4u_sb_url']` + `localStorage['ai4u_sb_anon_key']` — set via Settings panel

If neither is present → status = `not-configured` → app runs in local-only mode.

---

## Known Limitations

1. **No real-time sync across tabs/devices** — records load on init and after explicit sync. A second browser tab won't see new records until refresh.
2. **supabase-config.js 404** — if no config file exists, the browser will log a 404 for `supabase-config.js`. This is expected and handled by `onerror="void 0"`.
3. **Magic link auth requires email** — the user must have access to the email inbox. Password auth works without email for testing.
4. **localStorage sync_status** — the `sync_status` field on ledger entries only exists for entries created in V4. Older V3 entries will show no badge (treated as unsynced).
5. **Supabase free tier limits** — 500MB storage, 50MB database. Sufficient for personal use but consider upgrading for team use.

---

## Next Upgrade Path

### V4.1 — GitHub Actions Proof Workflow
Add a `.github/workflows/proof.yml` that:
- Runs on every push to `main`
- Fetches the live URL
- Verifies HTTP 200
- Posts a proof receipt to Supabase via a secure server-side function

### V4.2 — Dashboard Analytics
Add a dashboard panel that visualizes:
- Win rate over time
- Platform usage breakdown
- Stage success distribution
- Failure pattern frequency
All computed from `outcome_logs` in Supabase.

### V4.3 — AI-Assisted Route Scoring
Connect to Claude API (server-side via Vercel Edge Function) to:
- Analyze historical outcomes from Supabase
- Score platform candidates for a given task
- Return a ranked recommendation with explanation

---

## Security Checklist

- [x] No `service_role` key in any frontend file
- [x] RLS enabled on all 7 tables
- [x] All policies restrict to `auth.uid() = user_id`
- [x] `supabase-config.js` in `.gitignore`
- [x] Anon key is the only key in browser code
- [x] No secrets in `index.html`, `supabase-persistence.js`, or `vercel.json`
- [x] Auth via Supabase (not custom — avoids credential storage bugs)
- [x] localStorage cleared on explicit user action only (Clear Ledger button)
