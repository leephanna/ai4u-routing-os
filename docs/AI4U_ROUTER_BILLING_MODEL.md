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
- Task stage is Idea/Vision, Prototype, or Proof/Evaluation.
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

A high-risk or mission-critical task is never free. A complex first task receives its quote immediately; the free allowance remains available for a later eligible task.

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
- The Stripe account currently connected to the Router integration is live mode. Live Payment Links are created only after tax treatment is confirmed.

## Tax and fee caveat

Prices above are before any applicable sales tax, VAT, or GST. If Stripe Tax Basic is enabled for Payment Links/Checkout, its current no-code transaction fee must also be included in the margin calculation. Tax collected from customers is not revenue and should be remitted as required.

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
