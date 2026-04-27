# AI4U Right-Tool Routing OS — V4 Persistent Intelligence Layer

**Live:** [routing.ai4utech.com](https://routing.ai4utech.com) · [ai4u-routing-os.vercel.app](https://ai4u-routing-os.vercel.app)  
**Source:** [github.com/leephanna/ai4u-routing-os](https://github.com/leephanna/ai4u-routing-os)

---

## What is AI4U Routing OS?

An operating system for routing every task to the right AI platform, proving the result, preserving the artifact, and learning from every success or failure. Built on the AI4U Doctrine:

1. Pick the right platform first.
2. Write for that platform second.
3. Verify proof third.
4. Persist the artifact fourth.
5. Record what worked and failed fifth.
6. Improve future routes sixth.

---

## V3 (Static) vs V4 (Persistent)

| Feature | V3 Static | V4 Persistent |
|---|---|---|
| Storage | localStorage only | Supabase Postgres + localStorage fallback |
| Auth | None | Supabase Auth (email/password or magic link) |
| Cross-device | No | Yes — same data on all devices |
| Survives browser clear | No | Yes — cloud records persist |
| Offline support | Full | Full (localStorage fallback + sync queue) |
| Self-improvement | Basic (local stats) | Full (Supabase outcome logs → patterns) |
| Export | Local JSON | Local + Supabase JSON |

---

## Required Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a name (e.g., `ai4u-routing-os`) and a strong database password
3. Select a region close to your users
4. Wait for the project to be ready (about 1 minute)

### 2. Run the Schema SQL

1. In your Supabase project → **SQL Editor** → **New Query**
2. Open `supabase/schema.sql` from this repository
3. Paste the entire contents into the SQL Editor
4. Click **Run**
5. Confirm all 7 tables appear under **Database → Tables**:
   - `route_decisions`
   - `proof_receipts`
   - `outcome_logs`
   - `success_patterns`
   - `failure_rules`
   - `artifact_links`
   - `routing_settings`

### 3. Get Your API Keys

1. In Supabase → **Project Settings** → **API**
2. Copy your **Project URL** (e.g., `https://xxxx.supabase.co`)
3. Copy your **anon public** key

> **NEVER copy the `service_role` key.** It bypasses RLS and exposes all user data. The anon key is the only key needed in the browser.

### 4. Configure the App

**Option A — Config file (recommended for local dev):**

```bash
cp supabase-config.example.js supabase-config.js
# Edit supabase-config.js and paste your real URL and anon key
```

`supabase-config.js` is in `.gitignore` and will not be committed.

**Option B — Settings panel (works anywhere, no file needed):**

1. Open the app
2. Go to **Settings** panel → scroll to **Supabase Integration**
3. Paste your Project URL and Anon Key
4. Click **Save Config**
5. Click **Test Connection** to verify

### 5. Sign In

1. In the Settings panel → Supabase Integration → Authentication
2. Enter your email and password (or leave password blank for a magic link)
3. Click **Sign In / Send Magic Link**
4. Status will change to **Persistent V4 Enabled ✓**

---

## Deploying to Vercel

This is a static site — no build step needed.

1. Push to GitHub (on `main`)
2. In Vercel → **Import Project** → select `leephanna/ai4u-routing-os`
3. No build command, output directory, or environment variables required
4. Click **Deploy**

The `supabase-config.js` file is gitignored, so credentials never reach Vercel. Users configure Supabase through the Settings panel, which stores credentials in their browser's localStorage.

---

## Security

| Item | Status |
|---|---|
| Anon key in browser | ✓ Safe — RLS enforces ownership |
| Service role key | ✗ Never used in browser code |
| RLS on all tables | ✓ Enabled — `auth.uid() = user_id` on every table |
| Secrets in Git | ✗ None — `supabase-config.js` is gitignored |
| localStorage used | ✓ Offline fallback only |

---

## How to Test

1. Open the live site
2. Go to **Settings** → configure Supabase URL and Anon Key
3. Click **Save Config** → **Test Connection**
4. Sign in with your email
5. Go to **Route Engine** → fill in a task → click **Route This Task**
6. Click **Save Route Decision** in the result actions
7. Go to **Ledger** → log a task outcome → confirm "Synced" badge appears
8. Refresh the browser — confirm the record is still there
9. Open the app on a second browser or device
10. Sign in with the same account
11. Confirm the same records appear — that proves Supabase persistence

---

## Architecture

```
Browser (static HTML + Vanilla JS)
  ├── localStorage          ← always the first write / offline fallback
  ├── supabase-persistence.js  ← sync layer (window.AI4U_SB)
  └── Supabase JS Client (CDN)
         └── Supabase Project
               ├── Auth (email/password or magic link)
               └── Postgres + RLS (7 tables, owner-only policies)
```

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Full app — static HTML, CSS, JS |
| `supabase/schema.sql` | Run once in Supabase SQL Editor |
| `supabase-config.example.js` | Template — copy to `supabase-config.js` |
| `supabase-config.js` | Your real credentials (gitignored) |
| `supabase-persistence.js` | Persistence layer — defines `window.AI4U_SB` |
| `docs/PERSISTENCE_UPGRADE.md` | Architecture deep-dive |
| `vercel.json` | Static deployment config |

---

© 2026 AI4U, LLC — Lee Hanna, Owner
