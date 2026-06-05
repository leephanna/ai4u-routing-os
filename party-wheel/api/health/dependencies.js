// Dependency health check — reveals no secret values, only presence/format.
export default async function handler(_req, res) {
  const required = [
    "DATABASE_URL",
    "JWT_SECRET",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "OAUTH_SERVER_URL",
  ];

  const envCheck = {
    allPresent: required.every((k) => !!process.env[k]),
    missing: required.filter((k) => !process.env[k]),
  };

  // DB connectivity — dynamic import so this file never loads mysql2 unless called
  let dbCheck = { ok: false, error: "DATABASE_URL not set" };
  if (process.env.DATABASE_URL) {
    try {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection(process.env.DATABASE_URL);
      const [rows] = await conn.execute("SHOW TABLES LIKE 'rooms'");
      await conn.end();
      dbCheck = {
        ok: true,
        rooms_table: Array.isArray(rows) && rows.length > 0 ? "found" : "missing",
      };
    } catch (e) {
      // Sanitize error: remove any URL with credentials from message
      const msg = String(e?.message ?? e).replace(/mysql:\/\/[^@]*@/gi, "mysql://***@");
      dbCheck = { ok: false, error: msg };
    }
  }

  // Supabase format — values never exposed
  const supaUrl = process.env.VITE_SUPABASE_URL ?? "";
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";
  const supaCheck = {
    url_format: /^https:\/\/.+\.supabase\.co/.test(supaUrl) ? "valid" : "invalid_or_missing",
    anon_key_format: supaKey.split(".").length === 3 ? "valid_jwt" : "invalid_or_missing",
  };

  const allOk = envCheck.allPresent && dbCheck.ok;
  res.status(allOk ? 200 : 207).json({
    ok: allOk,
    env: envCheck,
    db: dbCheck,
    supabase: supaCheck,
  });
}
