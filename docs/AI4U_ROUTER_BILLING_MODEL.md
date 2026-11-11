# AI4U Router — Pricing, Billing, and Unit Economics

**Product:** AI4U Right-Tool Routing OS  
**Owner:** AI4U, LLC · Lee Hanna  
**Production site:** https://routing.ai4utech.com  
**Currency:** USD  
**Pricing objective:** Target at least 30% gross margin after payment processing and attributable operating costs.

## Recommended customer pricing

| Option | Price | Access |
|---|---:|---|
| Starter | One eligible task free | One low-complexity task per verified account; no card required |
| Monthly | $4.99 / month | Unlimited task routing and prompt generation |
| Annual | $49.99 / year | Same membership; saves $9.89 (about 17%) against 12 monthly payments |
| Pay per task — Basic | $1.99 | One basic route + prompt + task verification guidance |
| Pay per task — Standard | $2.99 | One standard route + prompt + task verification guidance |
| Pay per task — Advanced | $4.99 | One advanced route + prompt + task verification guidance |

The monthly plan becomes better value than pay-per-task after approximately three Basic tasks in a month. Annual membership is the best effective monthly price for regular users.

## Free-task eligibility threshold

A new verified account receives one free task only when all of these conditions are true:

- Complexity score is 2 or lower.
- Risk is Low or Medium.
- The account has not previously claimed its free task.

The complexity score is calculated server-side:

| Factor | Points |
|---|---:|
| Idea/Vision | 0 |
| Prototype or Proof/Evaluation | 1 |
| Business System | 2 |
| Broken Codebase, Production Deployment, Automation, or AI Agent/Widget | 3 |
| Low risk | 0 |
| Medium risk | 1 |
| High risk | 3 |
| Mission Critical | 5 |
| Goal over 300 characters | +1 |
| Goal over 800 characters | +2 instead of +1 |
| Multi-step / integration / migration / deployment / debugging indicators | +1 |
| More than two requested output items | +1 |

A high-risk or mission-critical task is never free. Technical stages receive higher complexity points, so involved repair, deployment, automation, and agent work will normally receive a paid quote. A complex first task receives its quote immediately; the free allowance remains available for a later eligible task.

## Unit-economics assumptions

This is a planning model, not a claim about the exact current invoices. Actual Vercel and Supabase plan assignments and usage must be reconciled against the account bills.

| Cost input | Planning assumption |
|---|---:|
| Vercel Pro platform fee | $20 / month |
| Supabase Pro platform fee | $25 / month |
| Combined fixed infrastructure baseline | $45 / month |
| Variable allowance | $0.05 / active user / month |
| Stripe domestic online card processing | 2.9% + $0.30 per successful payment |
| Stripe Billing for recurring subscriptions | 0.7% of recurring billing volume |
| AI model inference by the current Router code | $0.00 per task |

The $45 fixed baseline assumes one Vercel Pro platform fee and one Supabase Pro project fee are allocated entirely to Router. If those services are already shared with other AI4U products, Router's incremental fixed cost is lower. Vercel Pro includes a monthly usage credit; Supabase Pro includes its first project and compute credits. Usage above included quotas can change the estimate.

The $0.05 variable allowance is a conservative internal budget for small authentication, database, and function activity. It is not a measured per-user invoice amount.

**Important product boundary:** the current Router computes routes and generates prompts in the browser. It does not call OpenAI, Anthropic, Google, or another model for each task. The selected third-party AI platform performs the task, and its subscription or usage charges are paid separately by the user. If AI inference is added to Router later, the unit-economics model must be revised before launch.

## Subscription margin model

Stripe fees include both standard card processing and Stripe Billing's recurring-volume fee.

| Scenario | Monthly plan | Annual plan |
|---|---:|---:|
| Customer price | $4.99 | $49.99 |
| Paying users | 100 | 100 |
| Allocated infrastructure + variable allowance | $0.50 / month | $6.00 / year |
| Stripe processing + Billing fee | $0.48 / payment | $2.10 / payment |
| Estimated total cost | $0.98 | $8.10 |
| Estimated gross profit | $4.01 | $41.89 |
| Estimated gross margin | 80.4% | 83.8% |

Under the same assumptions, the monthly price clears the 30% gross-margin target at approximately 16 active paying subscribers; the annual price clears it at approximately 17 annual subscribers. At only 10 paying users, the full $45 fixed cost allocation is too high for these prices. Shared infrastructure or a growing subscriber base improves the margin.

## Pay-per-task margin model

The conservative illustration below allocates all $45 fixed infrastructure cost across 50 paid task purchases in a month ($0.90 per task), adds the $0.05 variable allowance, and includes Stripe card processing. Stripe Billing's 0.7% recurring fee does not apply to these one-time payments.

| Tier | Customer price | Stripe fee | Allocated infra + variable | Estimated gross profit | Gross margin |
|---|---:|---:|---:|---:|---:|
| Basic | $1.99 | $0.36 | $0.95 | $0.68 | 34.3% |
| Standard | $2.99 | $0.39 | $0.95 | $1.65 | 55.3% |
| Advanced | $4.99 | $0.44 | $0.95 | $3.60 | 72.0% |

The Basic tier reaches the 30% target at approximately 46 paid task purchases per month if it alone must absorb all $45 fixed infrastructure cost. Standard reaches it at approximately 28, and Advanced at approximately 17. In practice, subscription revenue also helps cover shared infrastructure, so task-only economics should improve as memberships grow.

## Quote and payment experience

1. User enters the task in Route Engine.
2. The server calculates complexity and checks subscription status and free-task eligibility.
3. The user sees the exact AI4U fee, task category, complexity score, and maximum fee before proceeding.
4. The user chooses **Pay & Continue** or **Cancel**.
5. Stripe hosts checkout. The Router does not unlock the paid task merely because the browser returns from checkout.
6. A signed Stripe webhook confirms payment and updates the private billing record.
7. The Router verifies the confirmed task entitlement and then runs the route.

A task quote is held for 30 minutes. If a customer completes checkout after the quote's display window, the paid transaction is still honored at the quoted amount; the app never takes a second payment to recover from a delayed webhook.

## Security and persistence

- Supabase email magic-link sign-in identifies the user.
- Free-task use is recorded server-side, once per authenticated account.
- Pending subscription passes and task quotes are recorded in a private Postgres schema.
- Payment confirmation is accepted only from a valid Stripe webhook signature.
- Webhook event IDs are stored for idempotent processing.
- The app never trusts a browser-only paid flag.
- The legacy $0.99/month Router Stripe price is preserved and is not silently replaced.
- The Stripe account is in live mode. Router products, prices, and Payment Links have now been created; the legacy $0.99/month Router price remains preserved.

## Tax and fee caveat

Prices above are before any applicable sales tax, VAT, or GST. If Stripe Tax Basic is enabled for Payment Links/Checkout, its current no-code transaction fee must also be included in the margin calculation. Tax collected from customers is not revenue and should be remitted as required.

## Production release record — 2026-11-10

**Deployment**
- GitHub PR #5 (pricing and secure billing) merged at `56e98e4d68723ba50c7fbd0c4e639244a5d5ba56`.
- GitHub PR #6 (tax wording) merged at `5b774c11bddf604e29bcbafc0b42486765e91ece`.
- Vercel production deployment: `dpl_4vD6rYzufbZK16jSFxqNvVpCwSyc`; READY; custom domain alias `routing.ai4utech.com`.

**Stripe live resources**
- Membership product: `prod_VbLKktIpcmZrYG`; monthly price `price_1Ua8e3ApPidFq8Rl4OxY7Z41` ($4.99/month); annual price `price_1Ua8eLApPidFq8RlLBj2xVjL` ($49.99/year).
- Task-pass product: `prod_VbLKYJFt0lAIaw`; Basic `price_1Ua8eCApPidFq8RlOCaMFBiy` ($1.99); Standard `price_1Ua8eOApPidFq8RloTOrZecT` ($2.99); Advanced `price_1Ua8ePApPidFq8RlJXDmgNXN` ($4.99).
- Five active Payment Links were created for these prices. Their IDs are stored in the Vercel environment; the app appends its server-issued `client_reference_id`. Do not share or use the raw links outside the app flow.
- Live webhook endpoint: `we_1Ua8evApPidFq8RlffQqvVTb`, targeting `https://routing.ai4utech.com/api/stripe/webhook`. Its signing secret is stored in Vercel and must never be committed to source control.

**Tax and activation**
- Stripe automatic tax is disabled on all five Payment Links. No sales tax is currently added at checkout, per the owner's current collection status. Reassess legal obligations and enable collection before it becomes required.
- Vercel production environment variables for the five links and webhook secret are configured.
- `AI4U_ROUTER_BILLING_ENABLED=false` remains in place until the production database health endpoint is verified. Do not enable checkout before that check passes.
- The existing legacy $0.99/month Router product and price were not modified.

## Database connectivity correction — 2026-11-10

The first production health check reported `database_configured: true` but `database_connected: false`. Review found that the initial billing database client assembled a direct connection from `POSTGRES_HOST`, `POSTGRES_USER`, and related variables, while the Vercel/Supabase integration also supplied pooled connection URLs that the client did not use.

The client now prefers `POSTGRES_URL`, then `POSTGRES_PRISMA_URL`, and falls back to the explicit host variables only if pooled URLs are absent. The per-instance pool is capped at one connection, consistent with Supabase guidance for serverless workloads. The health endpoint now initializes and verifies the private billing schema and returns a safe error code on failure.

- Fix merged to main: `739891aa7ed91cc51db4cc38dbde465d123773b9`.
- Production deployment: `dpl_u2UmqXkTGCyy86FCGiw2uZjweyaE`, READY, alias `routing.ai4utech.com`.
- Verification after this correction: pending owner refresh of `/api/billing/health`.
- Billing remains disabled until the health response confirms database connectivity and schema readiness.

## Implementation acceptance criteria

- [ ] Pricing page shows Free, Monthly, Annual, and Pay-per-task choices.
- [ ] The free-task threshold is calculated server-side, not trusted from browser code.
- [ ] A free task is claimed only after the user confirms.
- [ ] Complex tasks receive an exact fee estimate before checkout.
- [ ] Cancel does not charge and does not consume the free task.
- [ ] Stripe Checkout uses the correct live product/price.
- [ ] Signed webhooks confirm one-time payments and subscription lifecycle changes.
- [ ] Paid tasks unlock once; subscriptions unlock ongoing routing.
- [ ] Webhook retries are idempotent.
- [ ] Billing is disabled until the live Stripe links and webhook secret are configured.
- [ ] Existing Router features and Supabase persistence continue to work.

---

AI4U, LLC · Lee Hanna © 2026 AI4U, LLC. All rights reserved.

## PostgreSQL SSL compatibility fix and health verification — 2026-11-10

The production health check after the pooled-connection change returned `SELF_SIGNED_CERT_IN_CHAIN`. The Router uses `pg@8.16.3`. The node-postgres documentation explains that SSL-related URL parameters (`sslmode`, `sslrootcert`, `sslcert`, `sslkey`, and related flags) can replace the explicit `ssl` object passed to `Pool`. This can cause the connection-string settings to override the application's intended TLS configuration.

The connection client now normalizes the pooled connection URL by removing those SSL-specific query parameters while preserving all non-SSL parameters, then applies the existing explicit TLS configuration. The schema initializer was also corrected to separate SQL statements with actual newline characters.

**Production proof**
- GitHub PR #10 merged to main: `edf82fdb85c171880859505776b555275bf9e815`.
- Vercel production deployment: `dpl_MJjaFsijJvdJdmqnQP8Pe8ZASqbu`, state READY, alias `routing.ai4utech.com`.
- Live `GET /api/billing/health` returned: `ok=true`, `database_configured=true`, `database_connected=true`, `database_schema_ready=true`, `connection_mode=supabase-pooled`, `webhook_configured=true`, `billing_enabled=false`.
- Live `GET /api/billing/config` returned `enabled=false` and the expected price configuration.

**TLS security caveat and next gate**

The current compatibility configuration keeps the PostgreSQL connection encrypted, but uses `rejectUnauthorized: false`; it does not authenticate the database server's certificate chain or hostname. This is not the desired final production security posture. Supabase documents `verify-full` with the project's CA certificate as the strongest verification mode. Before activating live checkout, obtain the Supabase CA certificate from the project's Database Settings → SSL Configuration, add it as a protected Vercel production environment value (for example, `SUPABASE_DB_SSL_CA`), update the client to use `ssl: { ca: process.env.SUPABASE_DB_SSL_CA, rejectUnauthorized: true }`, remove any URL SSL parameters, and rerun the health check. Keep `AI4U_ROUTER_BILLING_ENABLED=false` until that verification and the remaining customer subscription-management gate are complete.

No database passwords, Stripe secrets, payment links, or other credentials were changed or added to source control.


## Strict PostgreSQL TLS verification and production proof — 2026-11-11

The Supabase Root 2021 CA certificate was supplied and validated as a PEM X.509 certificate. Its subject is `CN=Supabase Root 2021 CA`, its validity ends on 2021-04-26 10:56:53 UTC through 2031-04-26 10:56:53 UTC, and its SHA-256 fingerprint is `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

The certificate is stored in Vercel as the sensitive, Production-only environment variable `SUPABASE_DB_SSL_CA`. The certificate is not committed to GitHub. The database client now:
- Requires the configured CA certificate and fails closed if it is missing or malformed.
- Uses `ssl: { ca: process.env.SUPABASE_DB_SSL_CA, rejectUnauthorized: true }`.
- Requires Node TLS to validate the server certificate chain and hostname.
- Continues to remove SSL-related connection-string parameters before constructing the pool, so the URL cannot override the explicit TLS policy.
- Applies the same strict policy to the pooled URL and explicit host-variable fallback.

**Production proof**
- GitHub PR #12 merged to main: `1b4b646bbf9a7fdbc9cfc12697b798cc11845716`.
- Vercel production deployment: `dpl_BogW56FZG5bqwRjSZ3rDFXnm8A2i`, state READY, commit `1b4b646bbf9a7fdbc9cfc12697b798cc11845716`, alias `routing.ai4utech.com`.
- Live `GET /api/billing/health` returned: `{"ok":true,"database_configured":true,"database_connected":true,"database_schema_ready":true,"connection_mode":"supabase-pooled","webhook_configured":true,"billing_enabled":false}`.
- Live `GET /api/billing/config` returned: `{"enabled":false,"monthly_cents":499,"annual_cents":4999,"task_prices":{"basic":199,"standard":299,"advanced":499},"currency":"usd"}`.
- The successful production database query under `rejectUnauthorized: true` confirms the live Supabase connection passed certificate-chain and hostname verification.
- No checkout was activated and no payment was made.

**Remaining release gates**
1. Implement a Router-specific Stripe Customer Portal session endpoint and UI; do not modify the shared Stripe portal configurations used by other AI4U products.
2. Run non-charge entitlement checks: starter-task claim, quote/cancel path, and checkout open/cancel path.
3. Reconfirm health and config after those changes.
4. Obtain explicit owner authorization before changing `AI4U_ROUTER_BILLING_ENABLED` from `false` to `true`.

The earlier SSL caveat in the 2026-11-10 compatibility-fix section is historical and is superseded by this strict-TLS verification record. Billing remains disabled until the remaining release gates are complete.
