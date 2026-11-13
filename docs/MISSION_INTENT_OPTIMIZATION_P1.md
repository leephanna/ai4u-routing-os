# AI4U Mission Intent Optimization — P1 Contract

**Principle:** The user should feel guided, capable, and in control—not overwhelmed by technology.

## Goal
Turn an imperfect natural-language request into a transparent, typed mission proposal. **Improve the user's route without silently rewriting the user's intent.** This is the first bounded, dependency-free planner; it is not an LLM and does not claim semantic comprehension or independently execute external tools.

## Required behavior
1. Preserve the exact original objective (modulo safe whitespace cleanup).
2. Suggest an enhanced prompt with practical constraints, evidence expectations and explicit authorization boundaries.
3. Offer **three clear choices**: recommended (balanced), fastest useful, most thorough. Label their trade-offs.
4. Mark inferred intentions and missing success criteria as assumptions, never facts.
5. For insufficient input, ask **one targeted clarifying question** with three meaningful selectable wordings.
6. Generate typed, stable, ordered steps with action, measurable acceptance criteria, mode, approval gate and initial status.
7. Show a single next action based on status: clarify, review the optimized plan, or start an authorized narrowly scoped check.
8. Never perform payments, outbound communication, deletion, publication, or third-party edits from the planner output. Any actions require a separate permission-scoped executor.
9. Never assert full website readiness from the five existing HTTPS homepage checks.
10. Never invent a numeric AI confidence score. Compare alternative paths based on real user priorities and recorded evidence.

## Status contract
- `needs_clarification`: question and three choices are present; no execution is possible.
- `ready_for_review`: a proposed plan and alternatives exist; user confirmation and authorization are still necessary.
- `not_started`: all steps remain proposals, not executed results.

## Integration sequence (subsequent PR, not part of this PR)
- Wire planner to Mission Runner's initial goal field and display its suggestions without obscuring the user's original words.
- Allow **Keep my wording**, **Use suggested wording**, and **Choose an alternative**. Never replace text automatically.
- Show the most consequential trade-off first; put deeper comparisons behind an optional disclosure.
- Persist confirmed goal, selected alternative, constraints, approvals and versioned plan in the owner-scoped Supabase mission record.
- Add an inference adapter later for richer intent extraction; validate it against this same deterministic schema and explicit stop rules.
- Integrate per-step execution only with scoped tools, checkpoints, bounded retries, immutable *event history where actually enforced*, and proof receipts.
- Measure first 10 real pilot missions: clarity, time-to-first-action, intervention count, recovery, acceptance completion and user satisfaction.

## Definition of Done for this code-only slice
- New standalone `lib/mission/intent-planner.js` exposing `planMission(request)`.
- No secrets, external network calls, purchases or writes.
- Node native tests include vague goals, alternatives, risky requests, bounded website checks, and hard non-execution guarantees.
- Existing production Mission Runner is unchanged until a reviewed UI+storage integration PR.
- CI must pass before merge. This document is not evidence that CI passed.

## Future design principle: continual optimization
At every checkpoint the system may offer a better route **only if** it has a concrete benefit, e.g. fewer clicks, lower total cost, reduced risk, better evidence quality or shorter time to completion. Explain why the alternative improves the current route, let the user decline it, and avoid incessant suggestions. Preserve a decision record for chosen or declined material alternatives. Proactive improvement must not become distracting interruptions.
