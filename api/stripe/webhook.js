const crypto = require("crypto");
const db = require("../../lib/billing/db");
const { send } = require("../../lib/billing/http");

module.exports.config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function verifySignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = header.split(",").map(function (part) { return part.trim().split("="); });
  const timestampPart = parts.find(function (part) { return part[0] === "t"; });
  const signatures = parts.filter(function (part) { return part[0] === "v1"; }).map(function (part) { return part[1]; });
  if (!timestampPart || !signatures.length) return false;
  const timestamp = Number(timestampPart[1]);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const signed = Buffer.from(timestamp + "." + payload.toString("utf8"));
  const expected = crypto.createHmac("sha256", secret).update(signed).digest();
  return signatures.some(function (signature) {
    try {
      const received = Buffer.from(signature, "hex");
      return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    } catch (error) { return false; }
  });
}

function idOf(value) {
  return value && typeof value === "object" ? value.id : value || null;
}
function dateFromUnix(value) {
  return value ? new Date(Number(value) * 1000) : null;
}

async function activateSubscriptionPass(session) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
  const passId = String(session.client_reference_id || "");
  if (!passId) return;
  const subscriptionId = idOf(session.subscription);
  const customerId = idOf(session.customer);
  const updated = await db.query(
    "UPDATE ai4u_private.router_access_passes SET status='active',stripe_session_id=$2," +
    "stripe_customer_id=$3,stripe_subscription_id=$4,activated_at=COALESCE(activated_at,now()),updated_at=now() " +
    "WHERE id=$1 AND status IN ('pending','active') RETURNING user_id,plan_code",
    [passId, session.id, customerId, subscriptionId]
  );
  if (!updated.rows.length) return;
  const pass = updated.rows[0];
  await db.query(
    "INSERT INTO ai4u_private.router_entitlements " +
    "(user_id,stripe_customer_id,stripe_subscription_id,plan_code,status) " +
    "VALUES ($1,$2,$3,$4,'active') " +
    "ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id=EXCLUDED.stripe_customer_id," +
    "stripe_subscription_id=EXCLUDED.stripe_subscription_id,plan_code=EXCLUDED.plan_code," +
    "status='active',current_period_end=NULL,cancel_at_period_end=false,updated_at=now()",
    [pass.user_id, customerId, subscriptionId, pass.plan_code]
  );
}

async function activateTaskQuote(session) {
  if (session.payment_status !== "paid") return;
  const quoteId = String(session.client_reference_id || "");
  if (!quoteId) return;
  await db.query(
    "UPDATE ai4u_private.router_task_quotes SET status='paid',stripe_session_id=$2," +
    "stripe_customer_id=$3,paid_at=COALESCE(paid_at,now()),updated_at=now() " +
    "WHERE id=$1 AND amount_cents=$4 AND currency=$5 AND status IN ('quoted','expired')",
    [quoteId, session.id, idOf(session.customer), Number((session.amount_subtotal == null ? session.amount_total : session.amount_subtotal) || 0), String(session.currency || "usd").toLowerCase()]
  );
}

async function updateSubscription(subscription, eventType) {
  const subscriptionId = idOf(subscription);
  if (!subscriptionId) return;
  const existing = await db.query(
    "SELECT user_id FROM ai4u_private.router_entitlements WHERE stripe_subscription_id=$1 LIMIT 1",
    [subscriptionId]
  );
  if (!existing.rows.length) return;
  let status = String(subscription.status || "active");
  if (eventType === "customer.subscription.deleted") status = "canceled";
  const periodEnd = dateFromUnix(subscription.current_period_end);
  await db.query(
    "UPDATE ai4u_private.router_entitlements SET status=$2,current_period_end=$3," +
    "cancel_at_period_end=$4,stripe_customer_id=$5,updated_at=now() WHERE stripe_subscription_id=$1",
    [subscriptionId, status, periodEnd, !!subscription.cancel_at_period_end, idOf(subscription.customer)]
  );
}

async function updateInvoice(invoice, status) {
  const subscriptionId = idOf(invoice.subscription);
  if (!subscriptionId) return;
  const periodEnd = dateFromUnix(invoice.period_end);
  await db.query(
    "UPDATE ai4u_private.router_entitlements SET status=$2," +
    "current_period_end=COALESCE($3,current_period_end),updated_at=now() WHERE stripe_subscription_id=$1",
    [subscriptionId, status, periodEnd]
  );
}

async function processEvent(event) {
  const object = event.data && event.data.object ? event.data.object : {};
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      if (object.mode === "subscription") await activateSubscriptionPass(object);
      else if (object.mode === "payment") await activateTaskQuote(object);
      break;
    case "checkout.session.expired":
      if (object.client_reference_id) {
        await db.query(
          "UPDATE ai4u_private.router_task_quotes SET status='expired',updated_at=now() " +
          "WHERE id=$1 AND status='quoted'",
          [object.client_reference_id]
        );
        await db.query(
          "UPDATE ai4u_private.router_access_passes SET status='expired',updated_at=now() " +
          "WHERE id=$1 AND status='pending'",
          [object.client_reference_id]
        );
      }
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await updateSubscription(object, event.type);
      break;
    case "invoice.paid":
      await updateInvoice(object, "active");
      break;
    case "invoice.payment_failed":
      await updateInvoice(object, "past_due");
      break;
    default:
      break;
  }
}

module.exports = async function (req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return send(res, 503, { error: "Webhook secret is not configured." });
  try {
    const payload = await rawBody(req);
    const signature = req.headers["stripe-signature"];
    if (!verifySignature(payload, signature, secret)) return send(res, 400, { error: "Invalid Stripe signature." });
    const event = JSON.parse(payload.toString("utf8"));
    await db.ensureSchema();
    const record = await db.query(
      "INSERT INTO ai4u_private.router_webhook_events (event_id,event_type) VALUES ($1,$2) " +
      "ON CONFLICT (event_id) DO UPDATE SET received_at=now() RETURNING processed_at",
      [event.id, event.type]
    );
    if (record.rows[0] && record.rows[0].processed_at) return send(res, 200, { received: true, duplicate: true });
    await processEvent(event);
    await db.query(
      "UPDATE ai4u_private.router_webhook_events SET processed_at=now() WHERE event_id=$1",
      [event.id]
    );
    return send(res, 200, { received: true });
  } catch (error) {
    return send(res, 500, { error: "Webhook processing failed. Stripe may retry this event." });
  }
};