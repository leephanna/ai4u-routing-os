const { send } = require("../../lib/billing/http");
module.exports = function (req, res) {
  send(res, 200, {
    enabled: process.env.AI4U_ROUTER_BILLING_ENABLED === "true",
    portal_available: !!(process.env.STRIPE_ROUTER_PORTAL_API_KEY && process.env.AI4U_ROUTER_PORTAL_CONFIG_ID),
    monthly_cents: 499,
    annual_cents: 4999,
    task_prices: { basic: 199, standard: 299, advanced: 499 },
    currency: "usd"
  });
};