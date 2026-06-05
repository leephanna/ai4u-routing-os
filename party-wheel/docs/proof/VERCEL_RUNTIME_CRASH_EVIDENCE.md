# Vercel Runtime Crash Evidence

**Captured:** 2026-06-05  
**Deployment:** `dpl_8Zu55QvxThZhu1sPDAyf11N6nv74`  
**Commit:** `321349487144c60f19a7dbc2a54ba6fdf641e252`  
**Production URL:** `ai4u-party-wheel.vercel.app`

---

## Error Events (from Vercel runtime logs)

| Timestamp | Method | Path | Status |
|---|---|---|---|
| 2026-06-05 13:09:35 UTC | GET | /favicon.ico | 500 |
| 2026-06-05 13:09:30 UTC | GET | / | 500 |
| 2026-06-05 12:44:43 UTC | GET | /favicon.ico | 500 |
| 2026-06-05 12:44:40 UTC | GET | / | 500 |

All requests to all paths return 500 FUNCTION_INVOCATION_FAILED.

---

## Error Detail

**Function:** `/api/server` (Vercel serverless function via `@vercel/node@5.0.0`)  
**Error type:** `FUNCTION_INVOCATION_FAILED`

**First thrown error (sanitized):**
```
Error: Cannot find module '@rollup/rollup-linux-x64-gnu'.
npm has a bug related to optional dependencies (https://github.com/npm/cli/issues/4828).
Please try 'npm i' again after removing both package-lock.json and node_modules directory.
```

**Stack trace (sanitized):**
```
at requireWithFriendlyError
  (/var/task/node_modules/.pnpm/rollup@4.52.4/node_modules/rollup/dist/native.js:83:9)
at Object.<anonymous>
  (/var/task/node_modules/.pnpm/rollup@4.52.4/node_modules/rollup/dist/native.js:92:76)
at Module._compile (/opt/rust/bytecode.js:2:1451)
at O.l._compile (/opt/rust/bytecode.js:2:3854)
at Object..js (node:internal/cjs/loader:1838:10)
at Module.load (node:internal/cjs/loader:1441:32)
at Function.<anonymous> (node:internal/cjs/loader:1263:12)
...
[cause]: Error: Cannot find module '@rollup/rollup-linux-x64-gnu'
Require stack:
  /var/task/node_modules/.pnpm/rollup@4.52.4/node_modules/rollup/dist/native.js
```

---

## Build Environment

- Node.js: 22.x
- Builder: `@vercel/node@5.0.0`
- Package manager: pnpm 10.4.1
- Install command: `pnpm install --no-frozen-lockfile`
- Packages installed: 757 (all deps + devDeps including rollup@4.52.4)
- Region: Washington D.C. (iad1)

---

## Failure Classification

**Category A** — Missing module (`@rollup/rollup-linux-x64-gnu` not installed)  
**Category E** — Runtime incompatibility: `rollup` (a devDependency build tool) is loaded at serverless function startup, not at build time.

---

## Root Cause Analysis

**Path to failure:**

1. `api/server.js` imports `../dist/app.js` (the Express app)
2. `dist/app.js` was compiled from `server/_core/app.ts` with `--packages=external`, meaning all `node_modules` imports remain as runtime `require()`/`import` calls
3. `server/_core/app.ts` imports `serveStatic` from `./vite` (or equivalent)
4. `server/_core/vite.ts` has **static top-level imports**:
   ```typescript
   import { createServer as createViteServer } from "vite";
   import viteConfig from "../../vite.config";
   ```
5. These imports execute at module load time when the serverless function initializes
6. `vite` → loads `rollup` → `rollup/dist/native.js` tries to load `@rollup/rollup-linux-x64-gnu`
7. `@rollup/rollup-linux-x64-gnu` is a platform-specific optional dependency; pnpm on Vercel's Linux build machines doesn't install it (lockfile was generated on non-Linux, optional Linux-specific binary skipped)
8. → `FUNCTION_INVOCATION_FAILED`

**Why previous fix attempts failed:**
- Multiple `api/server.js` + `server/_core/app.ts` iterations still imported `serveStatic` from `vite.ts`, maintaining the static vite import chain
- `skipLibCheck`, TypeScript any-casts, and runtime fixes had no effect on the module load chain

**The definitive fix:**  
Create `server/_core/app.ts` that does NOT import from `server/_core/vite.ts` at all. Inline static serving directly (using `express.static` and `path` only). `vite.ts` is then only in the module graph of `server/_core/index.ts` (the development/local server), which is never deployed to Vercel.
