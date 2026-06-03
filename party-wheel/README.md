# AI4U Party Wheel

**AI4U Party Wheel: Glitch After Dark** is a standalone AI4U adult game-night app for 2–8 players on smartphones. It is intentionally separated from AI4U Router / Right-Tool OS.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Express + tRPC + Drizzle ORM + MySQL (TiDB)
- **Realtime:** Supabase Realtime broadcast channels
- **Auth:** JWT-based session cookies
- **Content:** Curated JSON content packs (3 intensity tiers, 9 segment types each)

## Game Overview

Players join a room on their phones and take turns spinning the wheel. Each segment maps to a game mode:

| Segment | Type |
|---|---|
| `braincell_check` | Trivia (multiple choice) |
| `truth_cache` | Truth questions |
| `glitch_dare` | Dare challenges |
| `prompt_duel` | Head-to-head prompts |
| `robot_slapdown` | Robot roast battle |
| `system_crash` | Group chaos round |
| `crowd_override` | Audience voting |
| `holo_drama` | Roleplay scenario |
| `firewall_bonus` | Bonus round |

## Getting Started

```bash
pnpm install
cp .env.example .env   # fill in your secrets
pnpm dev
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm check` | TypeScript type check |
| `pnpm test` | Unit tests |
| `pnpm content` | Validate content packs |
| `pnpm compliance` | TypeScript + tests |
| `pnpm db:push` | Run DB migrations |

## Environment Variables

See `.env.example` (not committed). Required:

- `DATABASE_URL` — MySQL/TiDB connection string
- `JWT_SECRET` — JWT signing secret
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase Realtime
- `VITE_GIPHY_API_KEY` — Giphy reactions
- `OAUTH_SERVER_URL` / `VITE_OAUTH_PORTAL_URL` — OAuth

## Relationship to AI4U Router

This app uses AI4U Router principles — proof contracts, Decision Ledger discipline, and Daedalus Gate-style verification. It does **not** live inside the AI4U Router codebase and does **not** import Router runtime code.

See [`docs/architecture/REPO_SEPARATION_CONTRACT.md`](docs/architecture/REPO_SEPARATION_CONTRACT.md) for the formal separation contract.

## Proof & Governance

- [`docs/proof/`](docs/proof/) — Daedalus Gate receipts
- [`docs/decision-ledger/`](docs/decision-ledger/) — Architectural decisions
- [`docs/architecture/`](docs/architecture/) — Separation contract
