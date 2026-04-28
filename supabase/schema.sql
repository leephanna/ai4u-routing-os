-- ═══════════════════════════════════════════════════════════
-- AI4U Routing OS V4 — Supabase Persistence Schema
-- ═══════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query).
-- All tables use RLS. Every record is owned by auth.uid().
-- Never share the service_role key — the anon key is sufficient.
-- ═══════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── updated_at trigger function ──────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════════════
-- TABLE: route_decisions
-- Stores every routing decision made in the Route Engine.
-- ═══════════════════════════════════════════════════════════
create table if not exists public.route_decisions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  task_title          text,
  task_stage          text,
  risk_level          text,
  goal                text,
  current_asset       text,
  failure_point       text,
  required_output     text,
  selected_platform   text,
  fallback_platform   text,
  why_selected        text,
  what_not_to_use_yet text,
  where_to_paste      text,
  generated_prompt    text,
  confidence_score    numeric,
  status              text default 'draft'
);

-- ═══════════════════════════════════════════════════════════
-- TABLE: proof_receipts
-- Stores proof artifacts for each completed task or deploy.
-- ═══════════════════════════════════════════════════════════
create table if not exists public.proof_receipts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  route_decision_id uuid references public.route_decisions(id) on delete set null,
  created_at        timestamptz default now(),
  proof_type        text,
  proof_title       text,
  proof_url         text,
  proof_notes       text,
  proof_status      text,
  screenshot_url    text,
  log_excerpt       text,
  verified_at       timestamptz
);

-- ═══════════════════════════════════════════════════════════
-- TABLE: outcome_logs
-- Ledger of task outcomes: worked / partial / failed.
-- Source of truth for Learning Intelligence statistics.
-- ═══════════════════════════════════════════════════════════
create table if not exists public.outcome_logs (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  route_decision_id       uuid references public.route_decisions(id) on delete set null,
  created_at              timestamptz default now(),
  task_title              text,
  platform_used           text,
  task_stage              text,
  outcome                 text,
  why_it_worked           text,
  why_it_failed           text,
  evidence                text,
  artifact_url            text,
  time_to_result_minutes  integer,
  cost_estimate           numeric,
  confidence_after        numeric
);

-- ═══════════════════════════════════════════════════════════
-- TABLE: success_patterns
-- Distilled frameworks from worked outcomes.
-- Powers future routing recommendations.
-- ═══════════════════════════════════════════════════════════
create table if not exists public.success_patterns (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  source_outcome_id       uuid references public.outcome_logs(id) on delete set null,
  created_at              timestamptz default now(),
  pattern_title           text,
  platform                text,
  task_stage              text,
  why_it_led_to_success   text,
  framework_to_duplicate  text,
  reuse_prompt            text,
  proof_standard          text,
  confidence_score        numeric default 0
);

-- ═══════════════════════════════════════════════════════════
-- TABLE: failure_rules
-- Avoidance rules extracted from failed outcomes.
-- Prevents repeating known failure patterns.
-- ═══════════════════════════════════════════════════════════
create table if not exists public.failure_rules (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  source_outcome_id uuid references public.outcome_logs(id) on delete set null,
  created_at        timestamptz default now(),
  failure_title     text,
  platform          text,
  task_stage        text,
  where_it_went_wrong text,
  root_cause        text,
  avoidance_rule    text,
  fallback_strategy text,
  severity          text,
  confidence_score  numeric default 0
);

-- ═══════════════════════════════════════════════════════════
-- TABLE: artifact_links
-- Permanent links to outputs, deploys, repos, screenshots.
-- Satisfies Doctrine Step 4: Persist the artifact.
-- ═══════════════════════════════════════════════════════════
create table if not exists public.artifact_links (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  route_decision_id uuid references public.route_decisions(id) on delete set null,
  outcome_log_id    uuid references public.outcome_logs(id) on delete set null,
  created_at        timestamptz default now(),
  artifact_type     text,
  artifact_title    text,
  artifact_url      text,
  platform          text,
  notes             text
);

-- ═══════════════════════════════════════════════════════════
-- TABLE: routing_settings
-- Per-user preferences synced from the Settings panel.
-- One row per user (unique constraint on user_id).
-- ═══════════════════════════════════════════════════════════
create table if not exists public.routing_settings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade unique,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  owner_name       text default 'Lee Hanna',
  organization     text default 'AI4U LLC',
  default_risk     text default 'Medium',
  default_platform text,
  ai4u_site_url    text default 'https://AI4Utech.com',
  github_repo_url  text default 'https://github.com/leephanna/ai4u-routing-os'
);

-- ── updated_at triggers ──────────────────────────────────────
create trigger set_route_decisions_updated_at
  before update on public.route_decisions
  for each row execute function public.set_updated_at();

create trigger set_routing_settings_updated_at
  before update on public.routing_settings
  for each row execute function public.set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_route_decisions_user_created   on public.route_decisions(user_id, created_at desc);
create index if not exists idx_route_decisions_stage          on public.route_decisions(task_stage);
create index if not exists idx_route_decisions_platform       on public.route_decisions(selected_platform);

create index if not exists idx_proof_receipts_user_created    on public.proof_receipts(user_id, created_at desc);
create index if not exists idx_proof_receipts_route           on public.proof_receipts(route_decision_id);

create index if not exists idx_outcome_logs_user_created      on public.outcome_logs(user_id, created_at desc);
create index if not exists idx_outcome_logs_platform          on public.outcome_logs(platform_used);
create index if not exists idx_outcome_logs_outcome           on public.outcome_logs(outcome);
create index if not exists idx_outcome_logs_stage             on public.outcome_logs(task_stage);

create index if not exists idx_success_patterns_user_created  on public.success_patterns(user_id, created_at desc);
create index if not exists idx_failure_rules_user_created     on public.failure_rules(user_id, created_at desc);
create index if not exists idx_artifact_links_user_created    on public.artifact_links(user_id, created_at desc);

-- ── Enable Row Level Security ────────────────────────────────
alter table public.route_decisions   enable row level security;
alter table public.proof_receipts    enable row level security;
alter table public.outcome_logs      enable row level security;
alter table public.success_patterns  enable row level security;
alter table public.failure_rules     enable row level security;
alter table public.artifact_links    enable row level security;
alter table public.routing_settings  enable row level security;

-- ── RLS Policies: route_decisions ───────────────────────────
create policy "route_decisions owner select" on public.route_decisions
  for select using (auth.uid() = user_id);
create policy "route_decisions owner insert" on public.route_decisions
  for insert with check (auth.uid() = user_id);
create policy "route_decisions owner update" on public.route_decisions
  for update using (auth.uid() = user_id);
create policy "route_decisions owner delete" on public.route_decisions
  for delete using (auth.uid() = user_id);

-- ── RLS Policies: proof_receipts ────────────────────────────
create policy "proof_receipts owner select" on public.proof_receipts
  for select using (auth.uid() = user_id);
create policy "proof_receipts owner insert" on public.proof_receipts
  for insert with check (auth.uid() = user_id);
create policy "proof_receipts owner update" on public.proof_receipts
  for update using (auth.uid() = user_id);
create policy "proof_receipts owner delete" on public.proof_receipts
  for delete using (auth.uid() = user_id);

-- ── RLS Policies: outcome_logs ──────────────────────────────
create policy "outcome_logs owner select" on public.outcome_logs
  for select using (auth.uid() = user_id);
create policy "outcome_logs owner insert" on public.outcome_logs
  for insert with check (auth.uid() = user_id);
create policy "outcome_logs owner update" on public.outcome_logs
  for update using (auth.uid() = user_id);
create policy "outcome_logs owner delete" on public.outcome_logs
  for delete using (auth.uid() = user_id);

-- ── RLS Policies: success_patterns ──────────────────────────
create policy "success_patterns owner select" on public.success_patterns
  for select using (auth.uid() = user_id);
create policy "success_patterns owner insert" on public.success_patterns
  for insert with check (auth.uid() = user_id);
create policy "success_patterns owner update" on public.success_patterns
  for update using (auth.uid() = user_id);
create policy "success_patterns owner delete" on public.success_patterns
  for delete using (auth.uid() = user_id);

-- ── RLS Policies: failure_rules ─────────────────────────────
create policy "failure_rules owner select" on public.failure_rules
  for select using (auth.uid() = user_id);
create policy "failure_rules owner insert" on public.failure_rules
  for insert with check (auth.uid() = user_id);
create policy "failure_rules owner update" on public.failure_rules
  for update using (auth.uid() = user_id);
create policy "failure_rules owner delete" on public.failure_rules
  for delete using (auth.uid() = user_id);

-- ── RLS Policies: artifact_links ────────────────────────────
create policy "artifact_links owner select" on public.artifact_links
  for select using (auth.uid() = user_id);
create policy "artifact_links owner insert" on public.artifact_links
  for insert with check (auth.uid() = user_id);
create policy "artifact_links owner update" on public.artifact_links
  for update using (auth.uid() = user_id);
create policy "artifact_links owner delete" on public.artifact_links
  for delete using (auth.uid() = user_id);

-- ── RLS Policies: routing_settings ──────────────────────────
create policy "routing_settings owner select" on public.routing_settings
  for select using (auth.uid() = user_id);
create policy "routing_settings owner insert" on public.routing_settings
  for insert with check (auth.uid() = user_id);
create policy "routing_settings owner update" on public.routing_settings
  for update using (auth.uid() = user_id);
create policy "routing_settings owner delete" on public.routing_settings
  for delete using (auth.uid() = user_id);
