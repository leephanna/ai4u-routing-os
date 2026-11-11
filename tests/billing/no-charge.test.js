"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { computeTaskQuote } = require("../../lib/billing/quote");

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    end(body) { this.body = JSON.parse(body); }
  };
}
async function invoke(handler, body) {
  const res = response();
  await handler({ method: "POST", headers: {}, body }, res);
  return res;
}

test("One free eligible task is claimable once; quote cancellation does not charge or consume it", async () => {
  const db = require("../../lib/billing/db");
  const auth = require("../../lib/billing/auth");
  const oldQuery = db.query, oldTransaction = db.transaction, oldAuth = auth.requireUser;
  const oldFetch = global.fetch;
  const oldEnabled = process.env.AI4U_ROUTER_BILLING_ENABLED;
  const oldLink = process.env.AI4U_ROUTER_LINK_TASK_BASIC;
  const quotePath = require.resolve("../../api/task/quote");
  const claimPath = require.resolve("../../api/task/claim");
  const cancelPath = require.resolve("../../api/task/cancel");
  const user = { id: "00000000-0000-4000-8000-000000000001", email: "free@example.test", freeUsed: false };
  const quotes = new Map();
  let nextId = 1;
  let paymentRequests = 0;
  try {
    process.env.AI4U_ROUTER_BILLING_ENABLED = "true"; // Local mock only, never production.
    process.env.AI4U_ROUTER_LINK_TASK_BASIC = "https://buy.stripe.com/test-only-no-charge";
    auth.requireUser = async () => user;
    global.fetch = async () => {
      paymentRequests += 1;
      throw new Error("A no-charge test must never call an external payment API.");
    };
    db.query = async (sql, values) => {
      if (sql.startsWith("SELECT plan_code")) return { rows: [] };
      if (sql.startsWith("INSERT INTO ai4u_private.router_users")) return { rows: [] };
      if (sql.startsWith("SELECT COUNT(*)")) return { rows: [{ count: 0 }] };
      if (sql.startsWith("SELECT free_task_used_at")) return { rows: [{ free_task_used_at: user.freeUsed ? new Date() : null }] };
      if (sql.startsWith("INSERT INTO ai4u_private.router_task_quotes")) {
        const id = "quote-" + nextId++;
        const q = { id, user_id: values[0], task_hash: values[1], task_stage: values[2],
          risk_level: values[3], complexity_score: values[4], tier: values[5],
          amount_cents: values[6], status: "quoted", expires_at: new Date(Date.now() + 1800000).toISOString() };
        quotes.set(id, q);
        return { rows: [{ id, expires_at: q.expires_at }] };
      }
      if (sql.startsWith("UPDATE ai4u_private.router_task_quotes SET status='cancelled'")) {
        const q = quotes.get(values[0]);
        if (q && q.user_id === values[1] && q.status === "quoted" && q.amount_cents > 0) q.status = "cancelled";
        return { rows: [] };
      }
      throw new Error("Unexpected SQL: " + sql);
    };
    db.transaction = async work => work({
      query: async (sql, values) => {
        if (sql.startsWith("INSERT INTO ai4u_private.router_users")) return { rows: [] };
        if (sql.startsWith("SELECT * FROM ai4u_private.router_task_quotes")) {
          const q = quotes.get(values[0]);
          return { rows: q && q.user_id === values[1] ? [q] : [] };
        }
        if (sql.startsWith("SELECT free_task_used_at")) return { rows: [{ free_task_used_at: user.freeUsed ? new Date() : null }] };
        if (sql.startsWith("UPDATE ai4u_private.router_users SET free_task_used_at")) {
          user.freeUsed = true;
          return { rows: [] };
        }
        if (sql.startsWith("UPDATE ai4u_private.router_task_quotes SET status='claimed'")) {
          quotes.get(values[0]).status = "claimed";
          return { rows: [] };
        }
        throw new Error("Unexpected transaction SQL: " + sql);
      }
    });
    for (const path of [quotePath, claimPath, cancelPath]) delete require.cache[path];
    const quoteHandler = require(quotePath);
    const claimHandler = require(claimPath);
    const cancelHandler = require(cancelPath);

    const freeQuote = await invoke(quoteHandler, { goal: "Summarize this note", stage: "idea", risk: "low" });
    assert.equal(freeQuote.statusCode, 200);
    assert.equal(freeQuote.body.amount_cents, 0);
    assert.equal(freeQuote.body.free_eligible, true);
    assert.equal(freeQuote.body.payment_url, null);
    assert.equal(user.freeUsed, false);

    const freeClaim = await invoke(claimHandler, {
      quote_id: freeQuote.body.quote_id, task_hash: freeQuote.body.task_hash
    });
    assert.equal(freeClaim.statusCode, 200);
    assert.equal(freeClaim.body.free_task, true);
    assert.equal(user.freeUsed, true);

    const repeatClaim = await invoke(claimHandler, {
      quote_id: freeQuote.body.quote_id, task_hash: freeQuote.body.task_hash
    });
    assert.equal(repeatClaim.statusCode, 200);
    assert.equal(repeatClaim.body.resumed, true);

    const paidQuote = await invoke(quoteHandler, { goal: "Summarize another note", stage: "idea", risk: "low" });
    assert.equal(paidQuote.body.amount_cents, 199);
    assert.match(paidQuote.body.payment_url, /^https:\/\/buy\.stripe\.com\/test-only-no-charge/);
    assert.equal(new URL(paidQuote.body.payment_url).searchParams.get("client_reference_id"), paidQuote.body.quote_id);

    // Cancel before opening Stripe Checkout: no payment API call or free-task mutation.
    const cancel = await invoke(cancelHandler, { quote_id: paidQuote.body.quote_id });
    assert.equal(cancel.statusCode, 200);
    assert.equal(cancel.body.cancelled, true);
    assert.equal(quotes.get(paidQuote.body.quote_id).status, "cancelled");
    assert.equal(user.freeUsed, true);
    assert.equal(paymentRequests, 0);
  } finally {
    db.query = oldQuery; db.transaction = oldTransaction; auth.requireUser = oldAuth;
    global.fetch = oldFetch;
    if (oldEnabled === undefined) delete process.env.AI4U_ROUTER_BILLING_ENABLED;
    else process.env.AI4U_ROUTER_BILLING_ENABLED = oldEnabled;
    if (oldLink === undefined) delete process.env.AI4U_ROUTER_LINK_TASK_BASIC;
    else process.env.AI4U_ROUTER_LINK_TASK_BASIC = oldLink;
    for (const path of [quotePath, claimPath, cancelPath]) delete require.cache[path];
  }
});

test("Risk and complexity thresholds never grant a high-risk free task", () => {
  const free = computeTaskQuote({ goal: "Summarize a short note", stage: "idea", risk: "low" }, true);
  assert.equal(free.amount_cents, 0);
  assert.equal(free.free_eligible, true);
  const high = computeTaskQuote({ goal: "Deploy a production payment system", stage: "production", risk: "high" }, true);
  assert.equal(high.free_eligible, false);
  assert.equal(high.amount_cents, 499);
  assert.equal(high.tier, "advanced");
});
