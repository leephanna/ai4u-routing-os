const db = require("../_lib/db");
const { requireUser } = require("../_lib/auth");
const { send, fail } = require("../_lib/http");
module.exports = async function (req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  try {
    const user = await requireUser(req);
    const result = await db.query(
      "SELECT plan_code, status, current_period_end, cancel_at_period_end FROM ai4u_private.router_entitlements " +
      "WHERE user_id = $1 AND status IN ('active','trialing') " +
      "AND (current_period_end IS NULL OR current_period_end > now()) LIMIT 1",
      [user.id]
    );
    const entitlement = result.rows[0] || null;
    return send(res, 200, {
      signed_in: true,
      email: user.email,
      subscription_active: !!entitlement,
      plan_code: entitlement ? entitlement.plan_code : null,
      current_period_end: entitlement ? entitlement.current_period_end : null,
      cancel_at_period_end: entitlement ? entitlement.cancel_at_period_end : false
    });
  } catch (error) { return fail(res, error); }
};