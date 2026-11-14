# AI4U Routing OS — Wix read-only authorization and commerce audit (P4C)

Status: **feature-gated and disabled until a dedicated Wix Developer app exists.** Do NOT reuse the Wix app connected only to a ChatGPT conversation. Deployment of these files does **not** mean Wix authentication is active.

## Source register (Wix official documentation, consulted 2026-11-14)

1. [External install flow](https://dev.wix.com/docs/build-apps/launch-your-app/app-distribution/install-your-app/set-up-the-external-install-flow): unlisted apps require app ID and share URL ID. The install URL uses `https://www.wix.com/app-installer` with `appId`, `shareUrlId`, `postInstallationUrl`; callback carries `signedInstance`, `instanceId`, `tenantId` and preserves state.
2. [About external install flow](https://dev.wix.com/docs/build-apps/launch-your-app/app-distribution/install-your-app/about-the-external-install-flow): never trust unsigned `instanceId` or `tenantId`; verify the signed app instance and app/tenant.
3. [Wix OAuth](https://dev.wix.com/docs/build-apps/develop-your-app/auth/authenticate-using-oauth): installed app client_credentials grant uses app ID, app secret and app instance ID to mint short-lived tokens.
4. [Parse signed app instance](https://dev.wix.com/docs/build-apps/develop-your-app/auth/app-instances/parse-the-app-instance-query-parameter): HMAC-SHA256 verification (the page also recommends Token Info for the newer generic instance flow).
5. [Installed apps API](https://dev.wix.com/docs/api-reference/business-management/app-installation/app-installation/get-installed-apps): GET `/apps-installer-service/v1/app-instances`, `APP-MARKET.VIEW-INSTALLED-APP`; only eligible site user/API-admin permissions may access this endpoint, and an app instance may be denied.
6. [Query products V3](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/query-products): POST `/stores/v3/products/query` with `SCOPE.STORES.PRODUCT_READ`.

## Verified starting evidence
- Existing saved guided mission: Step 4, site name `Sparrow Wreath Preview`, Wix site ID `438bf0a6-4162-4166-9a14-30ccd129ff00`; original plan, homepage signed proof and commerce-readiness review preserved.
- User's homepage Proof Pack passed the five scoped network/HTML checks but does **not** establish payment, shipping, cart or Wix Stores.
- Wix connection inside ChatGPT is separate from AI4U Routing OS. Treat prior app inventory as *separately sourced*, not evidence of an installed AI4U OAuth app.

## Application flow (disabled until configured)
1. Signed-in user resumes the EXISTING guided mission, with the Commerce Readiness review already saved.
2. A server-side GET reports `not_configured` until all mandatory credentials are present **and** `AI4U_WIX_AUDIT_ENABLED=true`.
3. User explicitly acknowledges app installation and opens Wix authorization. Wix prompts for the site and granted permissions; no purchase or mutation is initiated by the Router.
4. Server creates a random 256-bit state, saves only its SHA-256 plus authenticated user/mission/expected site/15-minute expiry to a private table, then constructs Wix's official external installer link.
5. Wix redirects to `https://routing.ai4utech.com/api/mission/site-audit?wix_callback=1` with the original state and signed instance. Server checks the nonce, appId, signed instance HMAC, instance ID, site `tenantId`, and obtains an installed-app OAuth token. A mismatched site or expired/replayed state is rejected.
6. The installation instance ID is encrypted server-side via AES-256-GCM with the production-only key and stored in `ai4u_private.router_wix_connections`. The key and instance ID are NEVER returned to the browser.
7. After the user resumes, `Run Read-only Wix Inventory` makes exactly two fixed-destination Wix API calls: installed-app IDs count and a one-product sample from V3 catalog. Requests never include order, customer, invoice, checkout or payment APIs. A 403 or 404 is **unavailable**, not proof that an app or product is absent.
8. The resulting counts/unknown statuses are saved to `setup_context.wix_inspection` under the existing guided mission, with owner filtering, optimistic revision check, idempotency key, event ledger and independent Resume readback. The guided step remains **awaiting_site_review** until commerce verification extends beyond this initial inventory.

## Configuration — required remaining external owner action
A dedicated Wix **Developer** app must be created and configured with only the read permissions that support the audit, not write/management scopes. The developer must review Wix's site-specific access, allowed permissions and external install/callback documentation before turning this on. The app must have an *unlisted share install link*.

Set the following in **Vercel → AI4U Routing OS → Environment Variables → Production**:
- `AI4U_WIX_AUDIT_APP_ID`: app GUID (private server variable)
- `AI4U_WIX_AUDIT_APP_SECRET`: sensitive secret (never paste in chat or GitHub)
- `AI4U_WIX_AUDIT_SHARE_URL_ID`: GUID from the unlisted share install link (private server variable)
- `AI4U_WIX_AUDIT_ENCRYPTION_KEY`: **already installed as a production-only sensitive secret**, generated securely (don't overwrite unless rotating credentials)
- `AI4U_WIX_AUDIT_ENABLED`: **currently false**; set true only when developer app registration, scoped permissions, callback URL and smoke tests are validated.

Use `https://routing.ai4utech.com/api/mission/site-audit?wix_callback=1` as the HTTPS callback route. No other callback hosts are trusted. Enable only after explicit developer-app registration and permissions are confirmed; redeploy to load updated environment variables.

Do not store `app_secret`, OAuth tokens, signedInstance or raw Wix instance ID in GitHub, browser storage, exported proof packs or user-visible logs. The server deletes neither the saved guided mission nor its earlier proof when Wix authorization fails. The user can retry an expired 15-minute state without repeating the original goal.

## Threat boundaries and known limitations
- No Wix admin access before explicit site-owner app installation. This is an **app-installation flow**, not silent reuse of ChatGPT's connector.
- This pilot supports only the exact known Sparrow Wreath Preview site, and **never** another tenant ID.
- Even after installed app authorization, API permissions may not allow Get Installed Apps; display `unavailable` and keep uncertainty rather than a misleading "No installed apps" conclusion.
- The read-only V3 query returns only up to one product and no customer data; it does NOT verify a usable cart or checkout. Do not make success claims about payments/shipping.
- State is short-lived and hashed; signedInstance verified with HMAC before use; OAuth token must be issued before storing an instance; all durable credentials are encrypted.
- This feature does not create a Wix site, install Wix Stores, modify catalog, grant payment settings, publish a page or incur a subscription. Wix's owner-driven app installation itself is a consented external Wix action.
- The frontend may be production READY with the connection still `not_configured`. Mark this milestone **partial/configuration-blocked**, not live-connected.

## Release / proof / rollback
- GitHub Router Quality and Billing CI plus Vercel preview must pass before production merge.
- Production status endpoint must report `not_configured` until required Wix app inputs exist. A genuine signed-in authorizing user, Wix app installation, permission read, event persistence and refresh/resume check are necessary to claim end-to-end verification.
- Rollback: revert the PR and disable the `AI4U_WIX_AUDIT_ENABLED` flag. Retain private event records and prior proof; no destructive DB migration.
- Zapier workflows are not used or changed. If any future Zapier workflows are added, export/save them in Zapier before replacing or editing.
