const { Pool } = require("pg");
let pool;
let schemaPromise;

function normalizeConnectionString(connectionString) {
  // node-postgres replaces the Pool's explicit SSL object when the URL
  // contains sslmode, ssl, sslrootcert, sslcert, or sslkey. Supabase/Vercel
  // may provide SSL query parameters in the injected URL, so remove those
  // options and make the TLS policy below authoritative.
  const url = new URL(connectionString);
  ["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey"].forEach(function (key) {
    url.searchParams.delete(key);
  });
  return url.toString();
}

function getStrictSslConfig() {
  const ca = process.env.SUPABASE_DB_SSL_CA;
  if (!ca || !ca.includes("-----BEGIN CERTIFICATE-----") || !ca.includes("-----END CERTIFICATE-----")) {
    throw new Error("Strict PostgreSQL TLS verification requires the SUPABASE_DB_SSL_CA certificate.");
  }

  // Trust only the configured Supabase CA and require a valid certificate
  // chain and hostname. Do not fall back to rejectUnauthorized:false.
  return {
    ca,
    rejectUnauthorized: true
  };
}

function getPool() {
  if (pool) return pool;

  // Supabase's Vercel integration supplies POSTGRES_URL through Supavisor.
  // Prefer that serverless-safe pooled endpoint over db.<project>.supabase.co,
  // which is the direct IPv6 endpoint and may not be reachable from Vercel.
  const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  const ssl = getStrictSslConfig();

  if (connectionString) {
    pool = new Pool({
      connectionString: normalizeConnectionString(connectionString),
      ssl,
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true
    });
    return pool;
  }

  // Fallback for explicitly configured direct or session-pooler connections.
  const host = process.env.POSTGRES_HOST;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DATABASE;
  if (!host || !user || !password || !database) {
    throw new Error("The Router billing database connection is not configured.");
  }
  pool = new Pool({
    host,
    port: Number(process.env.POSTGRES_PORT || 5432),
    user,
    password,
    database,
    ssl,
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true
  });
  return pool;
}

const schemaSql = [
  "CREATE SCHEMA IF NOT EXISTS ai4u_private",
  "REVOKE ALL ON SCHEMA ai4u_private FROM PUBLIC",
  "CREATE TABLE IF NOT EXISTS ai4u_private.router_users (" +
    "user_id uuid PRIMARY KEY, email text NOT NULL, free_task_used_at timestamptz, " +
    "created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())",
  "CREATE TABLE IF NOT EXISTS ai4u_private.router_task_quotes (" +
    "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, task_hash text NOT NULL, " +
    "task_stage text NOT NULL, risk_level text NOT NULL, complexity_score integer NOT NULL, " +
    "tier text NOT NULL, amount_cents integer NOT NULL, currency text NOT NULL DEFAULT 'usd', " +
    "status text NOT NULL DEFAULT 'quoted', stripe_session_id text UNIQUE, stripe_customer_id text, " +
    "created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, " +
    "paid_at timestamptz, claimed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now())",
  "CREATE TABLE IF NOT EXISTS ai4u_private.router_access_passes (" +
    "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, plan_code text NOT NULL, " +
    "status text NOT NULL DEFAULT 'pending', stripe_session_id text UNIQUE, stripe_customer_id text, " +
    "stripe_subscription_id text, created_at timestamptz NOT NULL DEFAULT now(), " +
    "expires_at timestamptz NOT NULL, activated_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now())",
  "CREATE TABLE IF NOT EXISTS ai4u_private.router_entitlements (" +
    "user_id uuid PRIMARY KEY, email text, stripe_customer_id text, stripe_subscription_id text UNIQUE, " +
    "plan_code text NOT NULL, status text NOT NULL, current_period_end timestamptz, " +
    "cancel_at_period_end boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), " +
    "updated_at timestamptz NOT NULL DEFAULT now())",
  "CREATE TABLE IF NOT EXISTS ai4u_private.router_webhook_events (" +
    "event_id text PRIMARY KEY, event_type text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), " +
    "processed_at timestamptz)",
  "CREATE INDEX IF NOT EXISTS router_task_quotes_user_status_idx ON ai4u_private.router_task_quotes(user_id, status)",
  "CREATE INDEX IF NOT EXISTS router_access_passes_user_status_idx ON ai4u_private.router_access_passes(user_id, status)",
  "CREATE TABLE IF NOT EXISTS ai4u_private.router_eval_baselines (" +
    "baseline_id text PRIMARY KEY, report jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())",
  "INSERT INTO ai4u_private.router_eval_baselines (baseline_id,report) VALUES ('legacy-2026-11-11','{\"schema_version\":1,\"source\":\"Current source-code router; no AI or external provider called\",\"evaluation_type\":\"Curated reference-route agreement (not ground-truth task success)\",\"cases\":30,\"agreement_count\":20,\"disagreement_count\":10,\"error_count\":0,\"keyword_routes\":16,\"stage_routes\":14,\"limitations\":[\"Reference answers are editorial judgments, not independently benchmarked tool outcomes.\",\"No real user usability study or end-to-end task execution was performed.\",\"Stage and risk are supplied to the legacy UI, not automatically inferred.\",\"The legacy confidence percentage is derived from risk, not measured reliability.\"],\"results\":[{\"id\":\"R01\",\"goal\":\"Research solar incentives in Minnesota\",\"stage\":\"idea\",\"risk\":\"medium\",\"acceptable\":[\"Perplexity Pro\"],\"selected\":\"Perplexity Pro\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R02\",\"goal\":\"Fact-check a disputed political claim with an auditable evidence trail\",\"stage\":\"idea\",\"risk\":\"high\",\"acceptable\":[\"AI4U Truth Task Force\"],\"selected\":\"Perplexity Pro\",\"route_type\":\"keyword\",\"agreement\":false,\"error\":null},{\"id\":\"R03\",\"goal\":\"Compare current prices and reviews of three laptops\",\"stage\":\"idea\",\"risk\":\"low\",\"acceptable\":[\"Perplexity Pro\"],\"selected\":\"Perplexity Pro\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R04\",\"goal\":\"Draft a professional apology email to a customer\",\"stage\":\"idea\",\"risk\":\"medium\",\"acceptable\":[\"Claude Sonnet\"],\"selected\":\"Claude Sonnet\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R05\",\"goal\":\"Rewrite my resume without inventing experience\",\"stage\":\"idea\",\"risk\":\"medium\",\"acceptable\":[\"Claude Sonnet\"],\"selected\":\"Claude Sonnet\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R06\",\"goal\":\"Write a cover letter for a finance role\",\"stage\":\"idea\",\"risk\":\"low\",\"acceptable\":[\"Claude Sonnet\"],\"selected\":\"Claude Sonnet\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R07\",\"goal\":\"Plan a social media launch campaign\",\"stage\":\"idea\",\"risk\":\"low\",\"acceptable\":[\"ChatGPT-4o\"],\"selected\":\"ChatGPT-4o\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R08\",\"goal\":\"Create a content calendar for my business\",\"stage\":\"idea\",\"risk\":\"low\",\"acceptable\":[\"ChatGPT-4o\"],\"selected\":\"ChatGPT-4o\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R09\",\"goal\":\"Design a simple logo for a new brand\",\"stage\":\"idea\",\"risk\":\"low\",\"acceptable\":[\"ChatGPT-4o\"],\"selected\":\"ChatGPT-4o\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R10\",\"goal\":\"Create an illustrated event poster\",\"stage\":\"idea\",\"risk\":\"low\",\"acceptable\":[\"ChatGPT-4o\"],\"selected\":\"ChatGPT-4o\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R11\",\"goal\":\"Explain how compound interest works\",\"stage\":\"idea\",\"risk\":\"low\",\"acceptable\":[\"ChatGPT-4o\"],\"selected\":\"ChatGPT-4o\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R12\",\"goal\":\"Teach me basic Python programming\",\"stage\":\"idea\",\"risk\":\"low\",\"acceptable\":[\"ChatGPT-4o\"],\"selected\":\"ChatGPT-4o\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R13\",\"goal\":\"Organize a project plan with milestones\",\"stage\":\"idea\",\"risk\":\"low\",\"acceptable\":[\"ChatGPT-4o\"],\"selected\":\"ChatGPT-4o\",\"route_type\":\"keyword\",\"agreement\":true,\"error\":null},{\"id\":\"R14\",\"goal\":\"Brainstorm a roadmap for a new product\",\"stage\":\"idea\",\"risk\":\"low\",\"acceptable\":[\"ChatGPT-4o\"],\"selected\":\"Perplexity Pro\",\"route_type\":\"keyword\",\"agreement\":false,\"error\":null},{\"id\":\"R15\",\"goal\":\"Build a one-page marketing website for a local shop\",\"stage\":\"idea\",\"risk\":\"medium\",\"acceptable\":[\"Wix\",\"Replit Agent\"],\"selected\":\"ChatGPT-4o\",\"route_type\":\"keyword\",\"agreement\":false,\"error\":null},{\"id\":\"R16\",\"goal\":\"Launch a small store with product listings and payments\",\"stage\":\"idea\",\"risk\":\"high\",\"acceptable\":[\"Wix\"],\"selected\":\"Perplexity Pro\",\"route_type\":\"keyword\",\"agreement\":false,\"error\":null},{\"id\":\"R17\",\"goal\":\"Prototype an interactive customer dashboard\",\"stage\":\"prototype\",\"risk\":\"medium\",\"acceptable\":[\"Replit Agent\"],\"selected\":\"Replit Agent\",\"route_type\":\"stage\",\"agreement\":true,\"error\":null},{\"id\":\"R18\",\"goal\":\"Build a working full-stack MVP preview\",\"stage\":\"prototype\",\"risk\":\"medium\",\"acceptable\":[\"Replit Agent\"],\"selected\":\"Replit Agent\",\"route_type\":\"stage\",\"agreement\":true,\"error\":null},{\"id\":\"R19\",\"goal\":\"Fix a broken React application with failing tests\",\"stage\":\"broken\",\"risk\":\"high\",\"acceptable\":[\"Claude Code\"],\"selected\":\"Claude Code\",\"route_type\":\"stage\",\"agreement\":true,\"error\":null},{\"id\":\"R20\",\"goal\":\"Diagnose an authentication bug in an existing codebase\",\"stage\":\"broken\",\"risk\":\"high\",\"acceptable\":[\"Claude Code\"],\"selected\":\"Claude Code\",\"route_type\":\"stage\",\"agreement\":true,\"error\":null},{\"id\":\"R21\",\"goal\":\"Deploy a Next.js app to a public URL\",\"stage\":\"production\",\"risk\":\"high\",\"acceptable\":[\"Vercel\"],\"selected\":\"Vercel\",\"route_type\":\"stage\",\"agreement\":true,\"error\":null},{\"id\":\"R22\",\"goal\":\"Publish changes to my Wix site\",\"stage\":\"production\",\"risk\":\"medium\",\"acceptable\":[\"Wix\"],\"selected\":\"Vercel\",\"route_type\":\"stage\",\"agreement\":false,\"error\":null},{\"id\":\"R23\",\"goal\":\"Automate a weekly email summary without coding\",\"stage\":\"automation\",\"risk\":\"low\",\"acceptable\":[\"Zapier\"],\"selected\":\"Trigger.dev\",\"route_type\":\"stage\",\"agreement\":false,\"error\":null},{\"id\":\"R24\",\"goal\":\"Create a durable background job with retries\",\"stage\":\"automation\",\"risk\":\"high\",\"acceptable\":[\"Trigger.dev\"],\"selected\":\"Trigger.dev\",\"route_type\":\"stage\",\"agreement\":true,\"error\":null},{\"id\":\"R25\",\"goal\":\"Build an AI support agent with persistent history\",\"stage\":\"agent\",\"risk\":\"high\",\"acceptable\":[\"Vercel AI SDK\",\"Supabase\"],\"selected\":\"Manus Agent\",\"route_type\":\"stage\",\"agreement\":false,\"error\":null},{\"id\":\"R26\",\"goal\":\"Build a tool-using agent with independent verification\",\"stage\":\"agent\",\"risk\":\"critical\",\"acceptable\":[\"Vercel AI SDK\",\"Trigger.dev\"],\"selected\":\"Manus Agent\",\"route_type\":\"stage\",\"agreement\":false,\"error\":null},{\"id\":\"R27\",\"goal\":\"Run repeatable LLM prompt evaluations\",\"stage\":\"proof\",\"risk\":\"high\",\"acceptable\":[\"promptfoo\"],\"selected\":\"promptfoo\",\"route_type\":\"stage\",\"agreement\":true,\"error\":null},{\"id\":\"R28\",\"goal\":\"Verify the live deployment and run browser regression tests\",\"stage\":\"proof\",\"risk\":\"high\",\"acceptable\":[\"GitHub Actions\",\"Playwright\"],\"selected\":\"promptfoo\",\"route_type\":\"stage\",\"agreement\":false,\"error\":null},{\"id\":\"R29\",\"goal\":\"Set up Postgres authentication and file storage\",\"stage\":\"business\",\"risk\":\"high\",\"acceptable\":[\"Supabase\"],\"selected\":\"Supabase\",\"route_type\":\"stage\",\"agreement\":true,\"error\":null},{\"id\":\"R30\",\"goal\":\"Build a lightweight no-code CRM in Airtable\",\"stage\":\"business\",\"risk\":\"medium\",\"acceptable\":[\"Airtable\"],\"selected\":\"Supabase\",\"route_type\":\"stage\",\"agreement\":false,\"error\":null}]}'::jsonb) ON CONFLICT (baseline_id) DO NOTHING",
  "INSERT INTO ai4u_private.router_eval_baselines (baseline_id,report) VALUES ('router-v2-baseline-2026-11-12','{\"schema_version\":2,\"fixture\":\"baseline\",\"cases\":30,\"agreement_count\":30,\"disagreement_count\":0,\"error_count\":0,\"evaluation_type\":\"Curated editorial reference-route agreement, not real-world task success\",\"source_path\":\"evals/routing-v2-baseline.json\",\"sha256\":\"dc093b1d61b6a4328614b71a9f041f338fa02f6ab6f7ad5cc5f5999e95922cf6\",\"limitations\":[\"The reference answers are editorial choices, not measured platform performance.\",\"Baseline, holdout and stress cases were examined during development; challenge cases were not used for subsequent tuning.\",\"Actual task success and user usability remain unmeasured.\"]}'::jsonb) ON CONFLICT (baseline_id) DO NOTHING",
  "INSERT INTO ai4u_private.router_eval_baselines (baseline_id,report) VALUES ('router-v2-holdout-2026-11-12','{\"schema_version\":2,\"fixture\":\"holdout\",\"cases\":40,\"agreement_count\":40,\"disagreement_count\":0,\"error_count\":0,\"evaluation_type\":\"Curated editorial reference-route agreement, not real-world task success\",\"source_path\":\"evals/routing-v2-holdout.json\",\"sha256\":\"9e274dbe284028b3b8f577d84e47b83507e19ebdf8aaa4051286920a3c4a8563\",\"limitations\":[\"The reference answers are editorial choices, not measured platform performance.\",\"Baseline, holdout and stress cases were examined during development; challenge cases were not used for subsequent tuning.\",\"Actual task success and user usability remain unmeasured.\"]}'::jsonb) ON CONFLICT (baseline_id) DO NOTHING",
  "INSERT INTO ai4u_private.router_eval_baselines (baseline_id,report) VALUES ('router-v2-stress-2026-11-12','{\"schema_version\":2,\"fixture\":\"stress\",\"cases\":20,\"agreement_count\":20,\"disagreement_count\":0,\"error_count\":0,\"evaluation_type\":\"Curated editorial reference-route agreement, not real-world task success\",\"source_path\":\"evals/routing-v2-stress.json\",\"sha256\":\"ec99681a02f6284fe5d1dda31efed006f2e691239c89f2f184f83df839b55e9f\",\"limitations\":[\"The reference answers are editorial choices, not measured platform performance.\",\"Baseline, holdout and stress cases were examined during development; challenge cases were not used for subsequent tuning.\",\"Actual task success and user usability remain unmeasured.\"]}'::jsonb) ON CONFLICT (baseline_id) DO NOTHING",
  "INSERT INTO ai4u_private.router_eval_baselines (baseline_id,report) VALUES ('router-v2-challenge-2026-11-12','{\"schema_version\":2,\"fixture\":\"challenge\",\"cases\":20,\"agreement_count\":17,\"disagreement_count\":3,\"error_count\":0,\"evaluation_type\":\"Curated editorial reference-route agreement, not real-world task success\",\"source_path\":\"evals/routing-v2-challenge.json\",\"sha256\":\"644cbfbd5a1d2d524f40ed5cc895ab327edf1c40158bc816826b65eb74419c88\",\"limitations\":[\"The reference answers are editorial choices, not measured platform performance.\",\"Baseline, holdout and stress cases were examined during development; challenge cases were not used for subsequent tuning.\",\"Actual task success and user usability remain unmeasured.\"],\"unresolved_case_ids\":[\"C01\",\"C03\",\"C07\"]}'::jsonb) ON CONFLICT (baseline_id) DO NOTHING",
  "CREATE TABLE IF NOT EXISTS ai4u_private.router_missions (" +
    "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, " +
    "target_url text NOT NULL, status text NOT NULL DEFAULT 'draft', " +
    "attempts integer NOT NULL DEFAULT 0, checks jsonb NOT NULL DEFAULT '[]'::jsonb, " +
    "evidence jsonb NOT NULL DEFAULT '{}'::jsonb, last_error text, " +
    "created_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz, " +
    "completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now())",
  "CREATE INDEX IF NOT EXISTS router_missions_owner_idx ON ai4u_private.router_missions(user_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS router_entitlements_subscription_idx ON ai4u_private.router_entitlements(stripe_subscription_id)"
].join(";\n") + ";";

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = getPool().query(schemaSql).then(function () {
      return true;
    }).catch(function (error) {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function query(text, values) {
  await ensureSchema();
  return getPool().query(text, values || []);
}

async function transaction(work) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { getPool, ensureSchema, query, transaction };
