# AI4U Router — Intent Routing V2: evaluation and release record

**Candidate date:** 2026-11-12 UTC  
**Baseline:** 2026-11-11 historical 30-task evaluation  
**Change type:** Deterministic recommendation logic, route descriptions, scorecard, evaluation persistence.  
**Risk:** Medium/high — incorrect tool selection can waste money or misdirect work. No checkout activation or destructive operations.

## Router Summary

The user successfully completed the first live Website Launch Readiness mission (five scoped PASS checks and status COMPLETE shown in the user-provided production screenshot). This establishes a user-visible completion result, **not** independent proof of download, cross-device resume, or a full site audit.

Next, the legacy Route Engine was improved without adding a new AI subscription. The goal is to select the appropriate tool based on *requested action, stage, and platform context*, rather than generic words such as “product” or “website”.

## Toolchain Selected

- **Wix:** ordinary business websites, storefronts and existing Wix publishing
- **Shopify:** explicitly requested Shopify stores
- **AI4U Truth Task Force:** contested claims requiring an auditable evidence trail
- **Perplexity:** current research and comparison (subscription availability must be checked)
- **ChatGPT / Claude:** creative planning, images and writing
- **Replit Agent:** interactive prototypes
- **Claude Code:** existing codebase repair
- **Vercel:** code-based production deployment
- **Zapier:** simple no-code automations (save/export workflows)
- **Trigger.dev:** durable code-based jobs
- **Vercel AI SDK + Supabase:** programmable agents and persistence
- **promptfoo:** model/prompt evaluations
- **GitHub Actions + Playwright:** browser/deployment regression proof
- **Airtable:** no-code CRM; Supabase for custom Postgres backends

These are editorial routing defaults, not independently benchmarked provider rankings. Verify current product features, pricing, and user entitlements before any paid action.

## Execution and measured results

| Evaluation | Original | V2 | Interpretation |
|---|---:|---:|---|
| Original 30 curated cases | 20/30 | 30/30 | In-sample improvements; 10 historical disagreements resolved |
| 40 validation cases | — | 40/40 | Reviewed during development; not an independent blind benchmark |
| 20 stress cases | — | 20/20 | Reviewed and used to improve general intent patterns |
| Final 20 challenge cases | — | 17/20 | Frozen before evaluation; no subsequent router tuning |

**Final challenge misses, preserved rather than concealed:**

1. C01: “I want an online appointment booking website” → ChatGPT; editorial reference Wix.
2. C03: “Create a newsletter announcing our product launch” → ChatGPT; editorial reference Claude Sonnet.
3. C07: “Find the latest census figures for Minnesota” → ChatGPT; editorial reference Perplexity Pro.

These three cases are the next improvement backlog. They were **not** patched after the final challenge run, preserving the distinction between development and challenge evaluations.

**No model accuracy, user satisfaction, real-world completion percentage, or statistically calibrated success probability is claimed.** Stage and risk still require user input. A future independent expert review should reassess editorial reference labels and include negative/ambiguous cases.

## Proof & Persistence

- Historical full report: `evals/baseline-2026-11-11.json`
- V2 fixtures: `evals/routing-cases.v1.json`, `evals/routing-holdout.v1.json`, `evals/routing-stress.v1.json`, `evals/routing-challenge.v1.json`
- V2 full results: `evals/routing-v2-{baseline,holdout,stress,challenge}.json`
- Reproducible runner: `node scripts/evaluate-routing.js --fixture=challenge`
- CI: `.github/workflows/router-quality.yml` with preserved evaluation artifacts and regression floors
- Database: four idempotently seeded `ai4u_private.router_eval_baselines` rows. Each stores summary counts, the GitHub evidence path and SHA-256 digest. The complete per-case data remains in GitHub.
- Read-only API: `GET /api/evals/baseline?version=legacy|baseline|holdout|stress|challenge` (allowlisted)
- No new service subscription, billing changes or charge.

## Acceptance criteria / next three actions

1. Pass Node regression suite, all four deterministic evaluations, and a browser smoke of the Route Engine.
2. Confirm GitHub Actions and Vercel Preview build. Preview is protected by Vercel Authentication; do not disable protection or copy Production credentials into Preview just to make a test pass.
3. Merge after review, verify production UI and persisted evaluation API, then queue a new evaluation iteration for the three challenge misses and a real five-person usability study.

**Remaining limitation:** A rule-based recommendation does not execute an arbitrary external mission. The current Mission Runner executes one narrowly scoped HTTPS homepage audit. Expansion must preserve explicit permissions, stop conditions, evidence and recovery.

**Zapier persistence rule:** When a Zapier workflow is added, save it in Zapier and export/document the configuration; a chat response is not a backup.
