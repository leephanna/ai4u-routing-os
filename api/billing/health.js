const db = require("../../lib/billing/db");
const { send } = require("../../lib/billing/http");

module.exports = async function (req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });

  if (req.query && req.query.baseline === "1") {
    const versions = Object.freeze({
      legacy: "legacy-2026-11-11",
      baseline: "router-v2-baseline-2026-11-12",
      holdout: "router-v2-holdout-2026-11-12",
      stress: "router-v2-stress-2026-11-12",
      challenge: "router-v2-challenge-2026-11-12"
    });
    const version = String(req.query.version || "legacy");
    if (!Object.prototype.hasOwnProperty.call(versions, version)) {
      return send(res, 400, { error: "Unknown evaluation version" });
    }
    try {
      const result = await db.query(
        "SELECT baseline_id, report, created_at FROM ai4u_private.router_eval_baselines WHERE baseline_id=$1",
        [versions[version]]
      );
      if (!result.rows.length) return send(res, 404, { error: "Baseline not available" });
      const row = result.rows[0];
      return send(res, 200, { baseline_id: row.baseline_id, recorded_at: row.created_at, report: row.report });
    } catch (error) {
      console.error("Router baseline read failed", { code: error.code || "UNKNOWN" });
      return send(res, 503, { error: "Baseline storage is temporarily unavailable" });
    }
  }

  const hasPooledUrl = !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
  const hasDirectParts = !!(process.env.POSTGRES_HOST && process.env.POSTGRES_USER &&
    process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DATABASE);
  const configured = hasPooledUrl || hasDirectParts;

  if (!configured) {
    return send(res, 503, { ok: false, database_configured: false });
  }

  try {
    // This also verifies the private billing schema and idempotently creates
    // its tables/indexes before checkout can ever be enabled.
    await db.ensureSchema();
    return send(res, 200, {
      ok: true,
      database_configured: true,
      database_connected: true,
      database_schema_ready: true,
      connection_mode: hasPooledUrl ? "supabase-pooled" : "configured-postgres",
      webhook_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
      billing_enabled: process.env.AI4U_ROUTER_BILLING_ENABLED === "true"
    });
  } catch (error) {
    const code = typeof error.code === "string" ? error.code : "UNKNOWN";
    console.error("AI4U Router database health check failed", {
      code,
      message: String(error.message || "Database connection failed").slice(0, 240)
    });
    return send(res, 503, {
      ok: false,
      database_configured: true,
      database_connected: false,
      database_error_code: code
    });
  }
};
