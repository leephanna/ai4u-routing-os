# AI4U Router — Guided Completion Standard v1

**Owner intent:** Make technically capable AI workflows usable by ordinary people, without forcing them to learn prompt engineering, platform terminology, or troubleshooting. The product must lead users from a plain-language goal to a verified result and explicit satisfaction.

**Status:** Product standard and release acceptance criteria. The Mission Runner completion-state UX is implemented in the accompanying change; the broader cross-platform guided journey is a roadmap requirement, **not** a claim that all features exist today.

## Router summary

- **Goal:** User states what they want; AI4U routes to the right tool, writes the right prompt, gives exact where-to-click instructions, observes/verifies the result when technically possible, preserves work, and guides corrections until the user chooses **I'm satisfied**.
- **Definition of done:** The user understands what happened, can see a trustworthy result, can save/reopen proof, and explicitly confirms satisfaction. Database success without visible feedback is **not** UX completion.
- **Constraints:** Mobile-first, novice-readable, accessible, low cognitive load, low cost, no false success claims, no hidden irreversible actions, and user consent for charges/publication.
- **Risk:** Medium for workflow confusion and abandonment; higher for financial, legal, public, or destructive operations. Require confirmation for irreversible or costly actions.

## Non-negotiable interface rules

1. **One dominant next action:** A visible **DO THIS NEXT** area must say exactly what to do, where, and why. The action changes with the current verified state. Secondary/legacy controls are visually subordinate or behind **Advanced**.
2. **No silent success:** Show **✓ MISSION COMPLETE — saved to your account** only after the server confirms the saved status. Once complete, the old **I'm Satisfied — Complete** button becomes a non-interactive **✓ MISSION COMPLETE** indicator. Never ask for the same acceptance twice.
3. **No fake completion:** A generated prompt, successful API response, or test pass is not proof of a user's desired real-world outcome. Label precisely what was tested and what remains unverified.
4. **Explain like a capable guide:** Avoid jargon in the primary path. Give copy-ready prompts, exact click destinations, expected results, and recovery instructions. Show technical details on demand.
5. **Preserve progress automatically:** Save to the system of record, support resume across refreshes, and make export and proof accessible. Do not make the user reconstruct earlier steps.
6. **Recover visibly:** On failure, identify the problem, preserve state, and offer one best retry or correction. Never strand the user on a technical error.
7. **Ask for satisfaction, not mere completion:** Keep iterating on the user's original goal until the user explicitly accepts the result or stops. Distinguish **verified by machine** from **accepted by user**.
8. **No needless friction:** Minimize form fields, account gates, tool switches, and competing CTAs. Explain any unavoidable sign-in or approval.
9. **Accessibility:** Screen-reader status announcements, 44px minimum mobile tap targets, keyboard focus, adequate contrast, and responsive layouts are release criteria.

## Mission Runner pilot state contract

| Server status | What the user sees | Primary action |
| --- | --- | --- |
| Draft (saved but not executed) | Mission is preserved; execution is still required | **Run Checks** |
| Running | Checks in progress | Wait for checks |
| Verified | Five scoped checks passed; review evidence and confirm satisfaction | **I'm Satisfied — Complete** |
| Needs attention / failed, fewer than five attempts | Specific failure and recovery guidance | **Retry Checks** after correction |
| Needs attention / failed, five attempts used | Prior attempt remains saved; create a fresh mission | **Start New Mission** |
| Complete | **✓ MISSION COMPLETE — saved to your account**, database confirmation, no repeat acceptance | **Download Signed Proof Pack V2** |

**Scope boundary:** The pilot checks HTTPS homepage transport, HTTP success, HTML response, page title, and viewport metadata. It does not certify complete website readiness, payment functionality, accessibility, or user satisfaction outside the explicitly accepted scoped mission. The signed proof receipt establishes what AI4U recorded, not third-party truth.

## Toolchain selected

- **GitHub:** Source-controlled interface changes, tests, review history, and quality-gate evidence.
- **Vercel:** Preview and production delivery of the existing Router.
- **Supabase:** Existing owner-scoped mission state and acceptance record; no schema change required for this UX fix.
- **Additional services:** Not needed for this fix. Future route execution may use a specialized platform only when the user's task warrants it.

## Execution plan and proof

1. Derive the completed UI state from the persisted server mission, not a local button click.
2. Show one state-specific next action and make the completed status unmistakable.
3. Keep signed proof export prominent after completion; collapse legacy export into Advanced.
4. Test successful acceptance, persisted resume, failure recovery, and action priority in the Node test suite.
5. Require CI pass and inspect the Vercel deployment before claiming production readiness.

## Acceptance tests for future workflows

- **Five novice participants:** Observe first-attempt task completion, time to first meaningful action, assistance requests, confusion, abandonment, and satisfaction. Do not claim scores until measured.
- **No repeat-click confusion:** On resume, a completed mission displays the completed indicator without asking for acceptance again.
- **One-action comprehension:** Within five seconds, a novice can identify the next action without consulting documentation (to be measured, not yet verified).
- **Durable result:** Refresh/reopen retains mission state; downloadable proof is correctly scoped and independently verifiable.
- **Failure recovery:** A failed check leads to a specific, safe next step rather than a dead end.

## Next three actions

1. Ship and verify the Mission Runner completion-state improvement.
2. Conduct an observed novice/mobile usability test, record evidence, and fix the largest friction point.
3. Extend the same guided-state contract to Route Engine → Prompt Gen → platform handoff → Proof Chain → Ledger, without representing the current recommendation-only paths as autonomous execution.
