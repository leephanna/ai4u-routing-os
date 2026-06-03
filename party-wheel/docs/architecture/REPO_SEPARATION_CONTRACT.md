# Repo Separation Contract

**Effective:** 2026-06-03  
**Status:** ACTIVE

---

## Source of Truth

| Product | Repository |
|---|---|
| AI4U Party Wheel | `leephanna/AI4U-PARTY-WHEEL` |
| AI4U Router / Right-Tool OS | `leephanna/ai4u-routing-os` |

These are separate, independently deployed applications. They share operating principles, not source code.

---

## Rules

### What Party Wheel MAY do
- Use AI4U Router proof-governance principles (Daedalus Gate, Harmonia, Decision Ledger)
- Adopt the Decision Ledger document format from AI4U Router
- Reference AI4U Router publicly as a related product ("by the same team")
- Import from npm packages that AI4U Router also happens to use

### What Party Wheel MUST NOT do
- Import runtime source code from `ai4u-routing-os`
- Deploy from `ai4u-routing-os` (Vercel or any host)
- Use AI4U Router's database tables as Party Wheel's system of record
- Share production environment variables between the two repos
- Have GitHub Actions that cross-commit between the two repos

### Future shared logic
If shared logic is needed later, create a dedicated shared package (e.g., `ai4u-shared-kernel` on npm) rather than copying code between repos or creating import-time coupling.

---

## Deployment

| Target | Correct repo |
|---|---|
| Vercel project for Party Wheel | `leephanna/AI4U-PARTY-WHEEL` only |
| GitHub Actions for Party Wheel | Inside `AI4U-PARTY-WHEEL` only |
| Party Wheel Decision Ledger | `AI4U-PARTY-WHEEL/docs/` only |
| Party Wheel Daedalus receipts | `AI4U-PARTY-WHEEL/docs/proof/` only |

---

## Relationship Statement

AI4U Party Wheel is a standalone AI4U adult game-night app. It uses the same proof-governance discipline as AI4U Router — Daedalus Gate receipts, Harmonia consensus, and the Decision Ledger format — because both products are built under the AI4U operating standard. This is a shared **methodology**, not shared **runtime code**.

AI4U Router remains the source of truth for the routing method / Right-Tool OS. Party Wheel remains the source of truth for the party game experience.

---

_Governed by: Decision Ledger DL-009_
