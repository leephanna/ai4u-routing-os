# Security Rotation Receipt — 2026-06-05

**Date:** 2026-06-05  
**Trigger:** Phase 0 security gate before production runtime recovery pass

---

## Scan Performed

**Command:**
```bash
grep -rn "ghp_|github_pat_|AKIA[A-Z0-9]|service_role|-----BEGIN" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.sh" \
  party-wheel/ --exclude-dir=node_modules --exclude-dir=dist
```

**Result:** `SCAN_CLEAN` — zero matches for GitHub PAT patterns (`ghp_`, `github_pat_`), AWS access key patterns (`AKIA`), Supabase service-role keys, or PEM headers in any committed source file.

---

## Credential Status

| Credential | Status | Location |
|---|---|---|
| GitHub PAT | Confirmed: no PAT pattern found in repo | Owner to verify revocation in GitHub Settings |
| Supabase service-role key | Confirmed: not present in source files | Owner to verify rotation in Supabase dashboard |
| Supabase anon key | Confirmed: not in source (was in .project-config.json, now `<REDACTED>`) | Vercel env vars |
| DATABASE_URL | Confirmed: not in source (was in .project-config.json, now `<REDACTED>`) | Vercel env vars |
| JWT_SECRET | Confirmed: not in source | Vercel env vars |
| AWS credentials | Confirmed: not in source (was in .project-config.json, now `<REDACTED>`) | Not used in Vercel deployment |
| Giphy API key | Confirmed: not in source | Vercel env vars |

---

## .project-config.json Status

The `.project-config.json` file (Manus platform deployment config) was redacted during the V2 Rescue Pass on 2026-06-03. All 20 sensitive values were replaced with `<REDACTED>`. The file is now excluded from the standalone `AI4U-PARTY-WHEEL` repo via `.gitignore`.

---

## Secret-Setting Scripts

No secret-setting scripts, `.env` files, or plaintext credential files found in the repo. The `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`, and `.project-config.json`.

---

## Required Owner Actions

The following cannot be confirmed by code scan and require manual verification:

1. **GitHub PAT revocation**: Go to GitHub → Settings → Developer Settings → Personal Access Tokens → revoke any PAT that was exposed.
2. **Supabase service-role key rotation**: If a service-role key was ever committed, rotate it in Supabase → Project Settings → API → Service Role key.
3. **Verify Vercel env vars are populated**: Confirm DATABASE_URL, JWT_SECRET, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY are set in Vercel → Project → Settings → Environment Variables.

---

## Verdict

`SCAN_CLEAN` — no secrets found in source code at time of scan. Owner manual verification required for items listed above.
