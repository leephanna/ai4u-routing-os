# AI4U Router — Android app packaging (isolated prototype)

This folder wraps the **existing** AI4U Routing OS static HTML/JS app in Capacitor 8. The live web deployment is not changed. A first native debug build is **not yet verified**; this branch is an integration scaffold, not a published app.

## Requirements
- Windows, Mac, or Linux
- Node.js 22+
- Android Studio 2025.2.1+ and Android SDK with Android API 36
- Java/JDK from Android Studio

## Start here
1. Clone https://github.com/leephanna/ai4u-routing-os and check out `feature/android-play-store-capacitor-v1`.
2. In a terminal, `cd mobile`.
3. Run `npm install`.
4. Run `npm run build:web`. This packages source app, Supabase JS, Chart.js, fonts, and images locally. Configuration is deliberately empty.
5. Run `npx cap add android` (first time only).
6. Run `npx cap sync android`.
7. Run `npx cap open android`.
8. In Android Studio select a virtual or plugged-in Android device and click **Run**.
9. Test Route Engine, prompt copy, ledger, refresh, offline operation, links, Supabase auth/sync, and small-screen UX.

## Important
- **Offline:** Core app and libraries are bundled; Supabase cloud sync requires a network connection. Test all offline features before promising offline functionality.
- **Cloud setup:** Existing Settings panel may be used to enter a per-user Supabase project URL and public key. This is a developer-oriented workflow and must be replaced with an AI4U-managed account onboarding before a paid retail release.
- **Security:** Never bundle Supabase service-role credentials, API provider secrets, or Play signing keys. Audit Supabase RLS before multi-user sale.
- **External links:** Existing `target="_blank"` links route to the Capacitor browser where available; verify this on real devices.
- **Play:** October 2026 new apps need target API 36 or higher. Confirm Gradle build target, current Play policies, signed AAB, Play App Signing, privacy policy, Data Safety, content rating, financial/advertising disclosures, and payment flow.
- **Store monetization:** Google Play Billing is required for most in-app digital purchases/subscriptions unless a specific exception/program applies. Do not insert Stripe checkout for the same in-app digital features without policy review.
- **Testing:** Run Play internal testing and applicable closed testing before production. No APK/AAB exists until native build runs.
- **License:** The current repository is public. Verify exclusive ownership, third-party asset licenses and whether a LICENSE is present before commercialization.
- **CI and proof:** Each app version should get a GitHub tag, dependency lockfile, Android test receipts, SHA-256 checksum, and a signed release build.

## Suggested release stages
1. **Developer preview:** debug APK, no payment, local-first functionality.
2. **Closed beta:** signed AAB, hosted account backend, privacy policy, backups and diagnostics.
3. **Paid launch:** billing/entitlements, onboarding, Play listing, required testing and release approvals.
