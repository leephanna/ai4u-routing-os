# Guided Step 4B — Evidence-backed Commerce Readiness Checkpoint

## Goal
Extend the existing account-saved guided storefront mission, not replace or reset it. Preserve Step 1 requirements (US, ship+pickup, under $50), Step 2 Wix choice, Step 3 existing site Sparrow Wreath Preview, and Step 4 awaiting site verification.

## Evidence and scope
- Verified user-owned signed homepage mission `6374615d-80ad-4d1e-aa5f-712ac6cf475a` for `https://headless-etnhqsdtksr-leehanna8-1409.wix-site-host.com/`.
- User's Signed Proof Pack V2 (2026-11-14) records HTTPS TLS, HTTP 200, HTML, nonempty title and viewport 5/5; sample length 11,661 bytes with SHA-256 `d7287fdc9c411d7022f7447be956c6c1f76bf3bc4a8cae96f05c1b5c4f42fbfb`. The Ed25519 signature is present, but the implementation independently checks DB ownership, mission state/checks and sample digest, not cryptographic signature verification.
- The HTML sample shows a promotional preview, showcase cards, `noindex`, and a statement that orders/payments are not accepted. No Wix cart/checkout, shipping or catalog configuration was verified.
- Separate read-only Wix site context previously showed headless/editorless Free site and no Wix Stores entry in installed apps. This is NOT direct app-level Wix authentication in Routing OS.

## Data contract
1. GET `/api/mission/site-audit?guided=1` looks up the selected site only if the current signed-in owner and exact site identifier match. It joins an owner-scoped completed router_missions record to its server-held sample for the exact public URL.
2. A completed record alone is insufficient: all five checks must pass and the sampled HTML SHA-256 must match. The result distinguishes verified homepage checks from unverified commerce capabilities.
3. The user explicitly acknowledges the scope and clicks **Save Commerce Readiness Review**; then the server recomputes the owner's proof under a transaction/row lock, and appends an idempotent event `commerce_readiness_review_recorded`.
4. The review lives in `setup_context.commerce_review` of the existing guided mission, with proof mission ID, hash, timestamp, verification scope and next-action hint. No new schema or table is introduced; revision increments. Step index remains 3 and status remains `awaiting_site_review` because storefront functionality is still not proven.
5. The client reads the record back before showing saved confirmation. Refresh/Resume reloads the same review and avoids duplicate submissions.

## Explicit limitations
- Not a Wix authentication/connection; no Wix admin requests from Routing OS.
- No catalog install, product uploads, checkout configuration, shipment setup, payment test, publishing, purchase or deployment.
- A matching home page or five green checks must never be interpreted as a functional online store.
- The original homepage mission's user satisfaction applies ONLY to the scoped homepage pilot.
- If owner proof or sample is missing, the control is not enabled; no false pass state.
- For sites other than the exact known Sparrow Wreath Preview fixture, display the need to connect and verify their own source—never reuse the proof from this site.

## Proof and release
GitHub quality, billing and Step 4 evidence tests; Vercel preview READY. Real signed-in Save→Refresh→Resume remains a production canary after rollout.

## Next milestone
Scoped Wix OAuth (owner-permissioned) or another authorized read-only inventory, product catalog, native Wix Stores app, cart, payment provider, pickup/shipping profiles, and real test checkout, then recommend the lowest-cost route with explicit authorization for any mutations. Avoid unnecessary new subscription or rebuild.
