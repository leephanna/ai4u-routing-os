const db = require("../_lib/db");
const { send } = require("../_lib/http");
module.exports = async function (req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  const configured = !!(process.env.POSTGRES_HOST && process.env.POSTGRES_USER &&
    process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DATABASE);
  if (!configured) return send(res, 503, { ok: false, database_configured: false });
  try {
    await db.query("SELECT 1");
    return send(res, 200, {
      ok: true,
      database_configured: true,
      webhook_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
      billing_enabled: process.env.AI4U_ROUTER_BILLING_ENABLED === "true"
    });
  } catch (error) {
    return send(res, 503, { ok: false, database_configured: true, database_connected: false });
  }
};