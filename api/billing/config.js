const { send } = require("../_lib/http");
module.exports = function (req, res) {
  send(res, 200, {
    enabled: process.env.AI4U_ROUTER_BILLING_ENABLED === "true",
    monthly_cents: 499,
    annual_cents: 4999,
    task_prices: { basic: 199, standard: 299, advanced: 499 },
    currency: "usd"
  });
};