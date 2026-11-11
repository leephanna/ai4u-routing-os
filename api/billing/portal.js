"use strict";
const db = require("../../lib/billing/db");
const { requireUser } = require("../../lib/billing/auth");
const { createPortalSession } = require("../../lib/billing/stripe-portal");
const { send, fail } = require("../../lib/billing/http");

module.exports = async function (req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    // The Stripe customer is always derived from this authenticated user's
    // private entitlement. Never accept a customer ID from browser input.
    const user = await requireUser(req);
    const found = await db.query(
      "SELECT stripe_customer_id FROM ai4u_private.router_entitlements " +
      "WHERE user_id=$1 AND stripe_customer_id IS NOT NULL " +
      "AND stripe_subscription_id IS NOT NULL " +
      "ORDER BY updated_at DESC LIMIT 1",
      [user.id]
    );
    if (!found.rows.length) {
      return send(res, 404, { error: "No Router membership was found for this account." });
    }

    const apiKey = process.env.STRIPE_ROUTER_PORTAL_API_KEY;
    const configurationId = process.env.AI4U_ROUTER_PORTAL_CONFIG_ID;
    if (!apiKey || !configurationId) {
      return send(res, 503, { error: "Subscription management is being configured. Please try again later." });
    }

    const url = await createPortalSession({
      customerId: found.rows[0].stripe_customer_id,
      configurationId,
      apiKey
    });
    return send(res, 200, { url });
  } catch (error) {
    if (error.stripeStatus) {
      console.error("AI4U Router Stripe portal error", { status: error.stripeStatus });
    }
    return fail(res, error);
  }
};
