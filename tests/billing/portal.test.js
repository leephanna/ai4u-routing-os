"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createPortalSession } = require("../../lib/billing/stripe-portal");

function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = JSON.parse(body); }
  };
}

test("Stripe portal helper uses a restricted server key and dedicated configuration", async () => {
  let request;
  const url = await createPortalSession({
    customerId: "cus_router123",
    configurationId: "bpc_router123",
    apiKey: "rk_live_fake_for_test_only",
    fetchImpl: async (endpoint, options) => {
      request = { endpoint, options };
      return { ok: true, json: async () => ({ url: "https://billing.stripe.com/p/session/test_session" }) };
    }
  });
  assert.equal(url, "https://billing.stripe.com/p/session/test_session");
  assert.equal(request.endpoint, "https://api.stripe.com/v1/billing_portal/sessions");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer rk_live_fake_for_test_only");
  const form = new URLSearchParams(request.options.body);
  assert.equal(form.get("customer"), "cus_router123");
  assert.equal(form.get("configuration"), "bpc_router123");
  assert.equal(form.get("return_url"), "https://routing.ai4utech.com/?portal=return");
});

test("Stripe portal helper rejects unexpected redirects, bad IDs, and Stripe failures", async () => {
  await assert.rejects(
    createPortalSession({ customerId: "cus_ok", configurationId: "bpc_ok", apiKey: "rk_test",
      fetchImpl: async () => ({ ok: true, json: async () => ({ url: "https://attacker.example/steal" }) }) }),
    /unexpected portal destination/
  );
  await assert.rejects(
    createPortalSession({ customerId: "cus_ok", configurationId: "bpc_ok", apiKey: "rk_test",
      fetchImpl: async () => ({ ok: false, status: 401 }) }),
    /could not open subscription management/
  );
  await assert.rejects(
    createPortalSession({ customerId: "cus_ok", configurationId: "wrong", apiKey: "rk_test" }),
    /Invalid Router portal configuration/
  );
});

test("Portal endpoint derives customer from authenticated Supabase user, never request body", async () => {
  const auth = require("../../lib/billing/auth");
  const db = require("../../lib/billing/db");
  const oldAuth = auth.requireUser;
  const oldQuery = db.query;
  const oldFetch = global.fetch;
  const oldKey = process.env.STRIPE_ROUTER_PORTAL_API_KEY;
  const oldConfig = process.env.AI4U_ROUTER_PORTAL_CONFIG_ID;
  const routePath = require.resolve("../../api/billing/portal");
  try {
    auth.requireUser = async () => ({ id: "user-router-1", email: "member@example.test" });
    db.query = async (sql, values) => {
      assert.match(sql, /WHERE user_id=\$1/);
      assert.deepEqual(values, ["user-router-1"]);
      return { rows: [{ stripe_customer_id: "cus_realRouter" }] };
    };
    process.env.STRIPE_ROUTER_PORTAL_API_KEY = "rk_live_fake_for_test_only";
    process.env.AI4U_ROUTER_PORTAL_CONFIG_ID = "bpc_router123";
    global.fetch = async (endpoint, options) => {
      const form = new URLSearchParams(options.body);
      assert.equal(form.get("customer"), "cus_realRouter");
      assert.equal(form.get("configuration"), "bpc_router123");
      return { ok: true, json: async () => ({ url: "https://billing.stripe.com/p/session/safe" }) };
    };
    delete require.cache[routePath];
    const handler = require(routePath);
    const res = fakeResponse();
    await handler({ method: "POST", body: { customer: "cus_attacker" }, headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { url: "https://billing.stripe.com/p/session/safe" });
    assert.equal(res.headers["Cache-Control"], "no-store");
  } finally {
    auth.requireUser = oldAuth;
    db.query = oldQuery;
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.STRIPE_ROUTER_PORTAL_API_KEY;
    else process.env.STRIPE_ROUTER_PORTAL_API_KEY = oldKey;
    if (oldConfig === undefined) delete process.env.AI4U_ROUTER_PORTAL_CONFIG_ID;
    else process.env.AI4U_ROUTER_PORTAL_CONFIG_ID = oldConfig;
    delete require.cache[routePath];
  }
});

test("Portal endpoint requires a signed-in user and linked membership", async () => {
  const auth = require("../../lib/billing/auth");
  const db = require("../../lib/billing/db");
  const oldAuth = auth.requireUser;
  const oldQuery = db.query;
  const routePath = require.resolve("../../api/billing/portal");
  try {
    auth.requireUser = async () => { const e = new Error("Sign in to continue."); e.status = 401; throw e; };
    delete require.cache[routePath];
    let handler = require(routePath);
    let res = fakeResponse();
    await handler({ method: "POST", headers: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Sign in to continue.");

    auth.requireUser = async () => ({ id: "user-without-subscription", email: "none@example.test" });
    db.query = async () => ({ rows: [] });
    delete require.cache[routePath];
    handler = require(routePath);
    res = fakeResponse();
    await handler({ method: "POST", headers: {} }, res);
    assert.equal(res.statusCode, 404);
    assert.match(res.body.error, /No Router membership/);

    res = fakeResponse();
    await handler({ method: "GET", headers: {} }, res);
    assert.equal(res.statusCode, 405);
  } finally {
    auth.requireUser = oldAuth;
    db.query = oldQuery;
    delete require.cache[routePath];
  }
});
