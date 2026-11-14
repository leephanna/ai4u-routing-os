# AI4U Guided Step 4 — Read-only Existing Site Verification

## Confirmed external evidence (November 13, 2026)
Target: `Sparrow Wreath Preview`; Wix site ID `438bf0a6-4162-4166-9a14-30ccd129ff00`; public URL `https://headless-etnhqsdtksr-leehanna8-1409.wix-site-host.com/`.

- The separately connected Wix account identifies this site as editorless/headless, free plan, and published.
- Its installed app listing has Wix SEO, Hotels and Invoices V2; Wix Stores is **not listed**.
- Separate read-only List Static Pages API returned one page titled `Home` at `/home`, with a `published=false` flag inconsistent with account-level published status. This requires further verification; neither source proves public availability.
- Separate CMS collection listing returned Wix app/system collection metadata. A native Wix Stores product catalog was **not established**.
- Actual live browser access, checkout, product inventory, shipping/pickup, and site ownership were not tested.

## Implementation — bounded scope
- Guided Step 4 displays the existing saved site and a public root HTTPS URL field. A known public Wix URL is prefilled only for the exact Sparrow Wreath Preview site name. This is a **suggested reference**, not ownership evidence or a Wix connection inside Routing OS.
- The user explicitly clicks **Prepare Read-only Homepage Check**; this validates the root HTTPS URL, then starts the *existing* account-scoped Website Launch Readiness pilot. No Wix admin calls are made by Routing OS.
- The existing pilot records its five network/HTML checks and separate signed Proof Pack receipt. **Step 4 remains awaiting site verification**, regardless of that pilot's result, until a later gated integration links evidence and separately assesses commerce readiness.
- Rejects non-HTTPS URL, passwords, query parameters, custom ports and non-root paths; the pilot has independent DNS/SSRF protections.
- No site creation, checkout, publishing, payment, connected-account claim, or modification.

## Deferred and important
The Wix connector in this ChatGPT conversation does not automatically authorize Wix inside Routing OS. A direct Wix OAuth connection and proper site-scoped permissions need a separate explicit approval and implementation. Native commerce readiness must be checked separately from public homepage success.

## Proof / rollback
GitHub CI and Vercel preview readiness before merging; account-authenticated live audit still requires canary. Roll back PR to recover prior UI; no schema changes or destructive writes in this release.
