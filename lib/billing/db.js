const { Pool } = require("pg");
let pool;
let schemaPromise;

function getPool() {
  if (pool) return pool;

  // Supabase's Vercel integration supplies POSTGRES_URL through Supavisor.
  // Prefer that serverless-safe pooled endpoint over db.<project>.supabase.co,
  // which is the direct IPv6 endpoint and may not be reachable from Vercel.
  const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (connectionString) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
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
    ssl: { rejectUnauthorized: false },
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
  "CREATE INDEX IF NOT EXISTS router_entitlements_subscription_idx ON ai4u_private.router_entitlements(stripe_subscription_id)"
].join(";\\n") + ";";

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
