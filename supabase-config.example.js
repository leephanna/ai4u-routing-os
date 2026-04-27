/*
  AI4U Routing OS V4 — Supabase Config (EXAMPLE)
  ═══════════════════════════════════════════════════════════
  1. Copy this file to:  supabase-config.js
  2. Replace the placeholder values below with your real
     Supabase project URL and anon key.
  3. supabase-config.js is in .gitignore — it will NOT be
     committed. This keeps credentials out of GitHub.

  Where to find your values:
  → Supabase Dashboard → Project Settings → API
  → "Project URL" and "anon public" key

  SECURITY:
  ✓ The anon key is safe to put here — RLS policies on every
    table ensure users can only read/write their own records.
  ✗ NEVER paste the service_role key here or anywhere in the
    browser. It bypasses RLS and exposes all user data.
  ═══════════════════════════════════════════════════════════
*/
window.AI4U_SUPABASE_CONFIG = {
  url:     'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY_HERE'
};
