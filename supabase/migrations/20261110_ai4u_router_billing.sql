-- AI4U Router billing schema
-- Applied automatically by the API's idempotent schema initializer.
-- Kept here as the durable, reviewable schema record.

CREATE SCHEMA IF NOT EXISTS ai4u_private;
REVOKE ALL ON SCHEMA ai4u_private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ai4u_private.router_users (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  free_task_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai4u_private.router_task_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_hash text NOT NULL,
  task_stage text NOT NULL,
  risk_level text NOT NULL,
  complexity_score integer NOT NULL,
  tier text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'quoted',
  stripe_session_id text UNIQUE,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  claimed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai4u_private.router_access_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  activated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai4u_private.router_entitlements (
  user_id uuid PRIMARY KEY,
  email text,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  plan_code text NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai4u_private.router_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS router_task_quotes_user_status_idx
  ON ai4u_private.router_task_quotes(user_id, status);
CREATE INDEX IF NOT EXISTS router_access_passes_user_status_idx
  ON ai4u_private.router_access_passes(user_id, status);
CREATE INDEX IF NOT EXISTS router_entitlements_subscription_idx
  ON ai4u_private.router_entitlements(stripe_subscription_id);
