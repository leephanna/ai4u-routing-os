const db = require("../_lib/db");
const { requireUser } = require("../_lib/auth");
const { send, readJson, fail } = require("../_lib/http");
module.exports = async function (req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const user = await requireUser(req);
    const body = await readJson(req);
    const quoteId = String(body.quote_id || "");
    if (!quoteId) return send(res, 400, { error: "Missing task quote." });
    await db.query(
      "UPDATE ai4u_private.router_task_quotes SET status='cancelled',updated_at=now() " +
      "WHERE id=$1 AND user_id=$2 AND status='quoted' AND amount_cents > 0",
      [quoteId, user.id]
    );
    return send(res, 200, { cancelled: true });
  } catch (error) { return fail(res, error); }
};