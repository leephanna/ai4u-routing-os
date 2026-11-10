const crypto = require("crypto");
const db = require("../../lib/billing/db");
const { requireUser } = require("../../lib/billing/auth");
const { computeTaskQuote } = require("../../lib/billing/quote");
const { send, readJson, fail } = require("../../lib/billing/http");

module.exports = async function (req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (process.env.AI4U_ROUTER_BILLING_ENABLED !== "true") {
    return send(res, 200, { enabled: false, allowed: true, reason: "billing_not_enabled" });
  }
  try {
    const user = await requireUser(req);
    const body = await readJson(req);
    const task = {
      goal: String(body.goal || "").trim(),
      stage: String(body.stage || "idea"),
      risk: String(body.risk || "medium"),
      asset: String(body.asset || "").trim(),
      failure: String(body.failure || "").trim(),
      output: String(body.output || "").trim()
    };
    const entitlement = await db.query(
      "SELECT plan_code FROM ai4u_private.router_entitlements WHERE user_id=$1 " +
      "AND status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now()) LIMIT 1",
      [user.id]
    );
    if (entitlement.rows.length) return send(res, 200, { enabled: true, allowed: true, reason: "subscription", plan_code: entitlement.rows[0].plan_code });

    await db.query(
      "INSERT INTO ai4u_private.router_users (user_id,email) VALUES ($1,$2) " +
      "ON CONFLICT (user_id) DO UPDATE SET email=EXCLUDED.email, updated_at=now()",
      [user.id, user.email]
    );
    const recentQuotes = await db.query(
      "SELECT COUNT(*)::int AS count FROM ai4u_private.router_task_quotes " +
      "WHERE user_id=$1 AND created_at > now() - interval '10 minutes'",
      [user.id]
    );
    if (recentQuotes.rows[0].count >= 10) return send(res, 429, { error: "Too many estimates in a short time. Please wait a few minutes and try again." });
    const usage = await db.query("SELECT free_task_used_at FROM ai4u_private.router_users WHERE user_id=$1", [user.id]);
    const freeAvailable = !usage.rows[0].free_task_used_at;
    const quote = computeTaskQuote(task, freeAvailable);
    const taskHash = crypto.createHash("sha256").update(JSON.stringify(task)).digest("hex");
    const created = await db.query(
      "INSERT INTO ai4u_private.router_task_quotes " +
      "(user_id,task_hash,task_stage,risk_level,complexity_score,tier,amount_cents,currency,status,expires_at) " +
      "VALUES ($1,$2,$3,$4,$5,$6,$7,'usd','quoted',now() + interval '30 minutes') RETURNING id,expires_at",
      [user.id, taskHash, task.stage, task.risk, quote.complexity_score, quote.tier, quote.amount_cents]
    );
    const quoteId = created.rows[0].id;
    let paymentUrl = null;
    if (quote.amount_cents > 0) {
      const envKey = quote.tier === "basic" ? "AI4U_ROUTER_LINK_TASK_BASIC" :
        quote.tier === "standard" ? "AI4U_ROUTER_LINK_TASK_STANDARD" : "AI4U_ROUTER_LINK_TASK_ADVANCED";
      const link = process.env[envKey];
      if (!link) return send(res, 503, { error: "Task checkout is not configured yet." });
      const checkout = new URL(link);
      checkout.searchParams.set("client_reference_id", quoteId);
      paymentUrl = checkout.toString();
    }
    return send(res, 200, {
      enabled: true,
      allowed: false,
      quote_id: quoteId,
      task_hash: taskHash,
      tier: quote.tier,
      complexity_score: quote.complexity_score,
      amount_cents: quote.amount_cents,
      currency: "usd",
      free_eligible: quote.free_eligible,
      expires_at: created.rows[0].expires_at,
      payment_url: paymentUrl
    });
  } catch (error) { return fail(res, error); }
};