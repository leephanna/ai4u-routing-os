# AI4U Router — Initial usability baseline (static inspection, not user testing)

**Date:** 2026-11-11
**Method:** Inspect existing HTML forms, navigation, and mission UI. No human participants, eye tracking, or observed completion times.

| Item | Existing Route Engine | First Mission Runner |
|---|---|---|
| Primary entry | Route Engine tab | Mission Runner tab / home CTA |
| Required task inputs | Goal, stage, risk | Public HTTPS URL; signed-in account |
| Execution | Recommendation and prompt | Real server-side HTTPS request |
| Outcome persistence | Manual save route/ledger | Automatic owner-scoped mission record |
| Recovery | Manual reroute | Resume mission and retry |
| Verification | Guidance checklist | Five machine-executed scoped checks |
| Proof export | Manual proof receipt / JSON export | One-click scoped Proof Pack JSON |
| Satisfaction confirmation | Not part of route completion | Explicit user acceptance after passing checks |

**Unmeasured:** Task completion time, conversion, abandonment, comprehension, accessibility, mobile device behavior, and satisfaction.

**Potential friction:** Account sign-in before the first mission; two interfaces (legacy Route Engine and Mission Runner); users may mistake a homepage HTTP audit for a complete website launch certification. Mitigations: visible scope disclosure, direct primary CTA, explicit failed-check detail, and no unsupported VERIFIED claims.

**Next study:** Five novice participants, with observed task times and error logs. Do not assign a usability score until that study exists.
