"use strict";

// This module deliberately does not use a Stripe SDK or expose a Stripe key
// to the browser. A restricted, server-only key is sufficient for portal sessions.
async function createPortalSession(options) {
  const customerId = String(options.customerId || "");
  const configurationId = String(options.configurationId || "");
  const apiKey = String(options.apiKey || "");
  const request = options.fetchImpl || fetch;

  if (!/^cus_[A-Za-z0-9]+$/.test(customerId)) {
    throw new Error("Invalid Stripe customer reference.");
  }
  if (!/^bpc_[A-Za-z0-9]+$/.test(configurationId)) {
    throw new Error("Invalid Router portal configuration.");
  }
  if (!apiKey) throw new Error("Router portal API credential is missing.");

  const form = new URLSearchParams({
    customer: customerId,
    configuration: configurationId,
    return_url: "https://routing.ai4utech.com/?portal=return"
  });

  const response = await request("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString(),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const error = new Error("Stripe could not open subscription management.");
    error.status = 502;
    error.stripeStatus = response.status;
    throw error;
  }

  const result = await response.json();
  let url;
  try { url = new URL(result.url); } catch (error) {
    throw new Error("Stripe returned an invalid portal session.");
  }
  if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com") {
    throw new Error("Stripe returned an unexpected portal destination.");
  }
  return url.toString();
}

module.exports = { createPortalSession };
