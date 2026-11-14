# Guided storefront P3 — Existing Wix Site Discovery

Purpose: **reuse existing assets before creating new websites**. The user should feel guided, capable and in control.

## State
P2 finished with `step_index=2`, `status=awaiting_setup`, and `route_choice.platform=wix`.
P3 records a user-reported site inventory choice via the authenticated shared mission API:
- `existing` (optionally provide public site name and HTTPS address)
- `new` (no existing site)
- `not_sure`

Successful submission saves `setup_context` in the private owner-scoped guided mission row and appends an event within the same Postgres transaction. Revision increments and the step advances to 3, `awaiting_site_review`. Request IDs prevent duplicate events and owner checks prevent cross-account access. A GET readback establishes the saved state before success is displayed.

## Explicit boundaries
- Site name and URL are **user-reported** and **not externally verified**. Connection: `not_connected`; checkout: `false`; created site: `false`.
- No live Wix connection, admin permissions, site creation, purchase, product modification or publication occurs through this workflow.
- No private login URLs, credentials or tokens should be entered.
- The first P3 checkpoint supports Wix, not Shopify or Square.
- Existing step records and Proof Packs remain unchanged; rollback reverts the UI/API commit without deleting user data.

## Next development gate
Verify which Wix account/site the user intends to reuse, inspect site inventory *read-only* with appropriate Wix connector permissions, then provide a contextual next action (reuse site / continue setup / request permission to create). Wix site listing available via the connected Wix app is not the same as an automatically connected Wix site inside Routing OS; never conflate them.

## Evidence needed
GitHub CI and Vercel READY preview, then real account Save→Readback→Refresh→Resume. Mocked tests alone cannot establish production persistence.
