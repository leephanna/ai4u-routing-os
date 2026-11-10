const db = require("../_lib/db");
const { requireUser } = require("../_lib/auth");
const { send, readJson, fail } = require("../_lib/http");

module.exports = async function (req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const user = await requireUser(req);
    const body = await readJson(req);
    const quoteId = String(body.quote_id || "");
    const taskHash = String(body.task_hash || "");
    if (!quoteId || !taskHash) return send(res, 400, { error: "The task quote could not be verified." });

    const result = await db.transaction(async function (client) {
      await client.query(
        "INSERT INTO ai4u_private.router_users (user_id,email) VALUES ($1,$2) " +
        "ON CONFLICT (user_id) DO UPDATE SET email=EXCLUDED.email, updated_at=now()",
        [user.id, user.email]
      );
      const quoteResult = await client.query(
        "SELECT * FROM ai4u_private.router_task_quotes WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [quoteId, user.id]
      );
      const quote = quoteResult.rows[0];
      if (!quote || quote.task_hash !== taskHash) return { status: 404, body: { error: "That task quote could not be found." } };
      if (quote.status === "claimed") return { status: 200, body: { allowed: true, quote_id: quoteId, task_hash: taskHash, tier: quote.tier, resumed: true } };
      if (quote.status === "paid") {
        await client.query(
          "UPDATE ai4u_private.router_task_quotes SET status='claimed',claimed_at=now(),updated_at=now() WHERE id=$1",
          [quoteId]
        );
        return { status: 200, body: { allowed: true, quote_id: quoteId, task_hash: taskHash, tier: quote.tier } };
      }
      if (quote.amount_cents !== 0 || quote.status !== "quoted") {
        return { status: 402, body: { error: "Payment has not been confirmed yet." } };
      }
      if (new Date(quote.expires_at).getTime() < Date.now()) {
        await client.query("UPDATE ai4u_private.router_task_quotes SET status='expired',updated_at=now() WHERE id=$1", [quoteId]);
        return { status: 410, body: { error: "That free-task quote expired. Please request a new estimate." } };
      }
      const userResult = await client.query(
        "SELECT free_task_used_at FROM ai4u_private.router_users WHERE user_id=$1 FOR UPDATE",
        [user.id]
      );
      if (userResult.rows[0].free_task_used_at) {
        return { status: 409, body: { error: "Your free starter task has already been used." } };
      }
      await client.query(
        "UPDATE ai4u_private.router_users SET free_task_used_at=now(),updated_at=now() WHERE user_id=$1",
        [user.id]
      );
      await client.query(
        "UPDATE ai4u_private.router_task_quotes SET status='claimed',claimed_at=now(),updated_at=now() WHERE id=$1",
        [quoteId]
      );
      return { status: 200, body: { allowed: true, quote_id: quoteId, task_hash: taskHash, tier: quote.tier, free_task: true } };
    });
    return send(res, result.status, result.body);
  } catch (error) { return fail(res, error); }
};