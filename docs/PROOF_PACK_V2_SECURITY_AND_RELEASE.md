# AI4U Router — Signed Proof Pack V2

## Router Summary

This release converts the first mission's browser-assembled JSON report into a **server-issued, Ed25519-signed, independently verifiable receipt**. It preserves the original V1 download. A signed receipt proves AI4U issued a specific record and that the sampled bytes match its manifest; it does **not** prove a website is safe, truthful, accessible, performant, or payment-ready.

**Scope:** HTTPS root-homepage response checks only: TLS validation, HTTP 2xx, HTML content, nonempty title and mobile viewport metadata.

## Toolchain Selected

Existing Vercel Node.js API, Supabase-backed private Postgres schema, GitHub Actions and Node's built-in `crypto`. No new paid services or dependencies.

## Execution Plan / Data flow

1. An authenticated owner starts and runs the HTTPS homepage mission. DNS is vetted and pinned to a public IPv4 address, with TLS certificate verification enabled.
2. The server retains **exact sampled response bytes**, up to 262,144 bytes. Hashing is performed on these bytes, not on re-encoded UTF-8 text. HTML may be truncated at the byte limit.
3. A single database transaction saves the mission report and an append-only per-attempt evidence row in `ai4u_private.router_mission_evidence`. The raw sample is **never** returned by the ordinary mission status API.
4. When the owner downloads V2, `GET /api/mission/site-audit?proof=1&mission_id=<uuid>` reads the owner's evidence, constructs a canonical JSON manifest, signs it using the production-only Ed25519 private key, and persists the receipt in `ai4u_private.router_mission_receipts`. Subsequent downloads of the same attempt/state reuse the saved receipt.
5. The downloaded pack contains the signed manifest, the original sample encoded as base64, a key ID and the verification-key URL. The independent offline verifier pins the public key separately and recomputes the signature, SHA-256 and sample length.
6. A user may download V1 as an unsigned legacy report. **V1 missions have no retained raw sample** and cannot be retroactively issued a V2 receipt. Start a fresh mission for V2 evidence.

## Offline verification

1. Obtain the verifier independently from `scripts/verify-proof-pack.js` in the official GitHub repository, not from inside the proof pack.
2. Obtain the trusted public key independently from `proof-key-v2.json` and confirm its fingerprint:
   `66d9b4bd1aac1f82ef5108a9710faa64c367dd9b9dc5ed3515c77fb36e6f3c83`
3. Run: `node scripts/verify-proof-pack.js AI4U_Signed_Proof_Pack_<mission-id>.json`.
4. PASS means the signed manifest is authentic to the pinned AI4U key and the sample matches the signed digest. FAIL means do not rely on the pack.
5. Do not treat a key embedded **only** inside a downloaded pack as trustworthy: an attacker could replace both the pack and its key.

## Security and privacy

- The Ed25519 private key is stored as a **sensitive, production-only Vercel environment variable**, `AI4U_PROOF_SIGNING_PRIVATE_KEY`. Never expose it in GitHub, client code, logs or downloaded packs.
- Owner authorization uses Supabase Auth `/auth/v1/user` and parameterized Postgres lookups. Evidence and receipts reside in `ai4u_private`, outside exposed schemas, with public privileges revoked.
- The sample can contain data present on the **public homepage** (including unintended personal information). It is retained privately, and **downloading or sharing the Proof Pack discloses the captured HTML bytes**. Do not share packs without inspecting this possibility.
- No cookies, authorization headers, response headers other than normalized content type, or raw credentials are included in the pack. No browser scripts execute during the audit.
- Evidence is capped at 256 KiB per attempt and five attempts per mission; the existing hourly new-mission limit remains in force.
- **Retention limitation:** No automatic evidence expiry or account deletion workflow has been added in this change. Raw samples and signed receipts remain in the private database until a retention/deletion process is implemented. A documented retention schedule and user deletion mechanism are required before broader public promotion.
- Key rotation/revocation is not yet automated. The published key is a pinned trust root for V2. A later key must have a distinct ID, be retained for old receipts, and be announced independently. Do not silently replace the trusted key.

## Proof & Persistence

- V2 core: `lib/mission/proof-v2.js`
- Public key: `proof-key-v2.json`
- Independent verifier: `scripts/verify-proof-pack.js`
- Authenticated download: `api/mission/site-audit.js` + `lib/mission/proof-export.js`
- Raw evidence capture: `lib/mission/site-audit.js`
- Per-attempt storage and transactional execution: `lib/billing/db.js`, `api/mission/site-audit.js`
- UI: `mission.js`, `index.html`
- Tests: `tests/mission/proof-v2.test.js`, `tests/mission/api-proof-pack.test.js` and existing regression tests
- CI: `.github/workflows/router-quality.yml`

## Release gates and remaining work

1. All unit, security, billing and routing regressions pass; invalid signature, altered bytes, wrong key, missing artifact and owner isolation are tested.
2. Vercel Preview builds; unauthenticated requests are rejected. Preview has no production signing key or production database credentials.
3. Review and merge PR, confirm Production deployment READY, key file served correctly, and billing remains disabled.
4. Run a **new** authenticated website mission and download its signed V2 pack. Verify offline. Old V1 missions are insufficient for this gate.
5. Before marketing as a broadly available evidence service: implement documented evidence retention/deletion and key rotation/revocation, and obtain an independent security review.

## Next three actions

1. Complete CI, PR review and Preview checks.
2. Merge and verify production configuration, API authorization and published trust root.
3. Ask the owner to run one fresh website mission and upload the V2 pack for independent verification; then proceed to the reusable Mission Engine.
