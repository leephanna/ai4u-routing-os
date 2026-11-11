# AI4U Router — Trust Repair, Baseline, and First Mission (2026-11-11)

## Delivery contract
- **Goal:** Make the Router safer, evidence-honest, measurable, and capable of a first real executed workflow.
- **Scope:** Existing HTML/JS app, private Postgres/Supabase-backed Router database, GitHub/Vercel deployment.
- **Risk:** High for security, data integrity, and release. No live billing activation, customer charge, or irreversible user action.
- **Not claimed:** An AI-powered adaptive router, a full website builder, a browser-based accessibility/performance audit, independent security certification, or real-user usability outcomes.

## Phase 0 — Security and truthfulness
- Ledger task, platform, date, notes, proof, and link fields are HTML-escaped before insertion. Artifact links require HTTP(S) URLs without credentials. Stored injection regression tests are included.
- Synthetic platform confidence percentages and route success charts were removed; numerical route confidence is now `null` until measured.
- Static proof PASS labels were changed to NOT TESTED. User-submitted receipts can be pending, failed, or user-attested; they cannot claim machine verification.
- Legacy model names were changed to model-family names. The Platform Matrix is explicitly editorial rather than benchmarked.
- Route Engine now requires a nonempty goal.
- Old roadmap statements were corrected to distinguish partial deployment from future work.
- **Remaining work:** Full security audit, content security policy, dependency scanning, production browser tests, and independent reviewer sign-off.

## Phase 1 — Deterministic 30-task baseline
- Fixture: `evals/routing-cases.v1.json` (30 task goals, stages, risks, editorial acceptable recommendations).
- Harness: `scripts/evaluate-routing.js` (extracts and executes the real browser routing algorithm without using an AI model).
- Original results: `evals/baseline-2026-11-11.json`.
- **20 / 30** editorial reference matches, **10** disagreements, **0** algorithm errors.
- 16 keyword-based and 14 stage-based routes.
- This is **reference-route agreement**, not an accuracy claim, customer usability score, or real-world completion rate.
- GitHub file and immutable database baseline ID `legacy-2026-11-11` preserve the original results.
- Read-only public API: `GET /api/evals/baseline`, served from private Postgres.
- Usability evidence remains limited to static flow inspection and controlled smoke tests; a real participant study is still required.

## Phase 2 — First executable Mission Runner
### Website Launch Readiness (narrow, complete workflow)
1. Sign in using the Router's Supabase Auth account.
2. Open **Mission Runner** and enter a public HTTPS homepage URL.
3. **Start & Run** creates an owner-scoped mission record in private Postgres and performs an actual server-side HTTPS GET.
4. DNS resolution is pinned to an approved public IPv4 address, with HTTPS-only redirects, a timeout, and a 256 KiB HTML sample cap.
5. Five evidence checks: valid TLS transport, HTTP 2xx, HTML response, nonempty title, mobile viewport.
6. The system stores actual results and a SHA-256 digest, not synthetic success indicators.
7. Retry after fixing the website; resume by mission ID from the same account; download the persisted Proof Pack JSON.
8. **I'm Satisfied — Complete** is enabled only when all scoped checks pass.

### Important limitations
- This workflow **does not create, publish, or modify websites**. It is the first bounded execution capability.
- HTTPS response checks do not establish browser rendering, image loading, accessibility, SEO quality, payment functionality, or overall site readiness.
- A failed check is not a full security diagnosis. No data from the target HTML is returned to the browser except a bounded page title and network metadata.
- Missions require account authentication and are rate-limited (5 new missions/hour; 5 attempts/mission).
- Public targets only; IP literals, private/reserved addresses, custom ports, URL credentials, query parameters, and non-root paths are blocked to reduce SSRF risk.
- The browser download is a copy; the owner-scoped mission and its proof remain in the private database.

## Proof & persistence
- GitHub branch: `ai4u/trust-baseline-mission-20261111`; review PR before merging.
- GitHub Actions: `router-quality.yml` tests billing, security, and mission flows; saves proof artifact for 90 days.
- Vercel preview: verify `GET /api/evals/baseline`, unauthenticated mission rejection, public mission page, and browser behavior.
- Production: release only after preview passes and explicit review of security and evidence limitations.
- Stripe live checkout remains OFF. Existing subscriptions and Customer Portal setup are outside this change.
- Zapier workflows, if added later, must be saved/exported separately to preserve their configurations.

## Observed browser smoke test (2026-11-11)
- Chromium headless smoke: five real HTTPS checks, scoped Proof Pack download, user satisfaction gate, resume after refresh, mobile navigation at 375 px, and stored Ledger XSS regression all passed.
- Browser test uses an in-memory mission API fixture; the HTTPS request is real. This does **not** verify live Supabase mission persistence or authenticated Vercel Preview HTTP responses.
- Vercel Preview deployment builds successfully, but Vercel Authentication protects its URL and the project has Production-only database credentials. We did not weaken protection or expose Production credentials to Preview.
- Proof record: `evals/browser-smoke-2026-11-11.json`.

## Manual usability pilot still needed
Recruit 5 first-time users. Give each one a website URL without coaching; observe time to first completed audit, confusion, sign-in friction, recovery after a failed check, and ability to retrieve proof after refresh. Record actual measurements in a separate study, not in the current reference-routing score.
