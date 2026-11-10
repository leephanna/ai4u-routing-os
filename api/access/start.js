const db = require("../_lib/db");
const { requireUser } = require("../_lib/auth");
const { send, readJson, fail } = require("../_lib/http");
module.exports = async function (req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const user = await requireUser(req);
    const body = await readJson(req);
    const plan = body.plan === "annual" ? "annual" : body.plan === "monthly" ? "monthly" : null;
    if (!plan) return send(res, 400, { error: "Choose a monthly or annual plan." });
    const active = await db.query(
      "SELECT plan_code FROM ai4u_private.router_entitlements WHERE user_id=$1 " +
      "AND status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now()) LIMIT 1",
      [user.id]
    );
    if (active.rows.length) return send(res, 200, { already_active: true, plan_code: active.rows[0].plan_code });
    const link = plan === "annual" ? process.env.AI4U_ROUTER_LINK_ANNUAL : process.env.AI4U_ROUTER_LINK_MONTHLY;
    if (!link) return send(res, 503, { error: "Checkout is not configured yet." });
    const pass = await db.query(
      "INSERT INTO ai4u_private.router_access_passes (user_id, plan_code, status, expires_at) " +
      "VALUES ($1,$2,'pending',now() + interval '2 hours') RETURNING id",
      [user.id, plan]
    );
    const checkout = new URL(link);
    checkout.searchParams.set("client_reference_id", pass.rows[0].id);
    return send(res, 200, { checkout_url: checkout.toString(), pass_id: pass.rows[0].id });
  } catch (error) { return fail(res, error); }
};