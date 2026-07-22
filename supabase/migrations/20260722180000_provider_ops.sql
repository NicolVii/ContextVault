-- Provider operations: DB-backed config + health + request telemetry.
-- Platform API keys stay in env / secret manager — never stored here.
-- BYOK ciphertext remains in user_provider_keys; this schema never reads it.

-- ---------------------------------------------------------------------------
-- Platform provider operational config
-- ---------------------------------------------------------------------------
create table public.inference_providers (
  id text primary key,
  display_name text not null,
  enabled boolean not null default true,
  fallback_priority int not null default 100,
  daily_cost_ceiling_usd_micros bigint
    check (
      daily_cost_ceiling_usd_micros is null
      or daily_cost_ceiling_usd_micros >= 0
    ),
  mock_only boolean not null default false,
  allow_platform boolean not null default true,
  allow_byok boolean not null default true,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.inference_providers is
  'Ops config for inference adapters. No API keys. Keys remain in env / BYOK vault.';

create trigger inference_providers_set_updated_at
  before update on public.inference_providers
  for each row execute function public.set_updated_at();

insert into public.inference_providers (
  id, display_name, enabled, fallback_priority, mock_only, allow_platform, allow_byok
) values
  ('openrouter', 'OpenRouter', true, 10, false, true, true),
  ('openai', 'OpenAI', true, 20, false, true, true),
  ('anthropic', 'Anthropic', true, 30, false, true, true),
  ('google', 'Google', true, 40, false, true, true),
  ('groq', 'Groq', true, 50, false, true, true),
  ('mock', 'Mock fallback', true, 1000, true, false, false);

-- ---------------------------------------------------------------------------
-- Model operational overrides (overlays in-code MODEL_CATALOG)
-- ---------------------------------------------------------------------------
create table public.inference_model_overrides (
  model_id text primary key,
  enabled boolean not null default true,
  auto_eligible boolean not null default true,
  frontier_eligible boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.inference_model_overrides is
  'Ops overrides for catalog models: enablement and Auto/Frontier eligibility.';

create trigger inference_model_overrides_set_updated_at
  before update on public.inference_model_overrides
  for each row execute function public.set_updated_at();

insert into public.inference_model_overrides (
  model_id, enabled, auto_eligible, frontier_eligible
) values
  ('openai.gpt-4o-mini', true, true, false),
  ('openai.gpt-4o', true, false, true),
  ('anthropic.claude-3.5-sonnet', true, false, true),
  ('google.gemini-flash-1.5', true, true, false),
  ('meta.llama-3.1-70b-instruct', true, true, false);

-- ---------------------------------------------------------------------------
-- Admin-triggered health probes (never store secrets or vendor bodies)
-- ---------------------------------------------------------------------------
create table public.provider_health_checks (
  id uuid primary key default gen_random_uuid(),
  provider text not null references public.inference_providers (id) on delete cascade,
  ok boolean not null,
  latency_ms int,
  error_class text,
  checked_at timestamptz not null default now(),
  actor_user_id uuid references auth.users (id) on delete set null,
  meta jsonb not null default '{}'::jsonb
);

create index provider_health_checks_provider_checked_idx
  on public.provider_health_checks (provider, checked_at desc);

comment on table public.provider_health_checks is
  'Safe admin health probes. meta must never contain API keys or raw responses.';

-- ---------------------------------------------------------------------------
-- Per-attempt ops telemetry (success / failure / failover / mock)
-- ---------------------------------------------------------------------------
create table public.provider_ops_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  provider text not null,
  model_id text,
  provider_model_id text,
  outcome text not null
    check (outcome in ('success', 'failure', 'failover', 'mock_fallback')),
  latency_ms int,
  error_class text,
  cost_usd_micros bigint not null default 0,
  created_at timestamptz not null default now()
);

create index provider_ops_events_provider_created_idx
  on public.provider_ops_events (provider, created_at desc);

create index provider_ops_events_request_id_idx
  on public.provider_ops_events (request_id)
  where request_id is not null;

comment on table public.provider_ops_events is
  'Inference attempt telemetry for ops dashboards. No secrets.';

-- Optional latency on settled usage for cost/latency joins.
alter table public.usage_events
  add column if not exists latency_ms int,
  add column if not exists failover_count int not null default 0;

-- ---------------------------------------------------------------------------
-- RLS: service_role only (admin APIs use service role; never expose to clients)
-- ---------------------------------------------------------------------------
alter table public.inference_providers enable row level security;
alter table public.inference_model_overrides enable row level security;
alter table public.provider_health_checks enable row level security;
alter table public.provider_ops_events enable row level security;
-- No authenticated policies: only service_role (bypasses RLS) may read/write.
