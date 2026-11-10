const db = require("../_lib/db");
const { requireUser } = require("../_lib/auth");
const { send, fail } = require("../_lib/http");
module.exports = async function (req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  try {
    const user = await requireUser(req);
    const sessionId = String(req.query.session_id || "");
    if (!sessionId) return send(res, 400, { error: "Missing checkout session." });
    const result = await db.query(
      "SELECT id, task_hash, tier, amount_cents, status FROM ai4u_private.router_task_quotes " +
      "WHERE user_id=$1 AND stripe_session_id=$2 LIMIT 1",
      [user.id, sessionId]
    );
    const quote = result.rows[0] || null;
    return send(res, 200, {
      confirmed: !!quote && ["paid","claimed"].includes(quote.status),
      status: quote ? quote.status : "pending",
      quote_id: quote ? quote.id : null,
      task_hash: quote ? quote.task_hash : null,
      tier: quote ? quote.tier : null
    });
  } catch (error) { return fail(res, error); }
};