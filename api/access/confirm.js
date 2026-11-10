const db = require("../../lib/billing/db");
const { requireUser } = require("../../lib/billing/auth");
const { send, fail } = require("../../lib/billing/http");
module.exports = async function (req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  try {
    const user = await requireUser(req);
    const sessionId = String(req.query.session_id || "");
    if (!sessionId) return send(res, 400, { error: "Missing checkout session." });
    const result = await db.query(
      "SELECT id, plan_code, status FROM ai4u_private.router_access_passes " +
      "WHERE user_id=$1 AND stripe_session_id=$2 LIMIT 1",
      [user.id, sessionId]
    );
    const pass = result.rows[0] || null;
    return send(res, 200, { confirmed: !!pass && pass.status === "active", status: pass ? pass.status : "pending", plan_code: pass ? pass.plan_code : null });
  } catch (error) { return fail(res, error); }
};