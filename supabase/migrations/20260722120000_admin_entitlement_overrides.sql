-- Admin entitlement grants and plan simulations for hosted demos / support.
-- Mutations are service-role only; resolution prefers simulation → grant →
-- real subscription → Free. Demo rows never count as paid revenue.

create table public.admin_entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null
    check (plan_id in ('free', 'lite', 'pro')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  auto_turn_bonus integer not null default 0
    check (auto_turn_bonus >= 0),
  frontier_turn_bonus integer not null default 0
    check (frontier_turn_bonus >= 0),
  credit_bonus integer not null default 0
    check (credit_bonus >= 0),
  credit_bonus_applied_at timestamptz,
  storage_bytes_override bigint
    check (storage_bytes_override is null or storage_bytes_override >= 0),
  feature_overrides jsonb not null default '{}'::jsonb,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  -- Admin grants are never Stripe revenue.
  exclude_from_revenue boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create trigger admin_entitlement_grants_set_updated_at
  before update on public.admin_entitlement_grants
  for each row execute function public.set_updated_at();

create index admin_entitlement_grants_user_active_idx
  on public.admin_entitlement_grants (user_id, starts_at desc)
  where revoked_at is null;

create index admin_entitlement_grants_user_ends_idx
  on public.admin_entitlement_grants (user_id, ends_at)
  where revoked_at is null;

create table public.admin_plan_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null
    check (plan_id in ('free', 'lite', 'pro')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  auto_turn_bonus integer not null default 0
    check (auto_turn_bonus >= 0),
  frontier_turn_bonus integer not null default 0
    check (frontier_turn_bonus >= 0),
  credit_bonus integer not null default 0
    check (credit_bonus >= 0),
  credit_bonus_applied_at timestamptz,
  storage_bytes_override bigint
    check (storage_bytes_override is null or storage_bytes_override >= 0),
  feature_overrides jsonb not null default '{}'::jsonb,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  -- Simulations are never Stripe revenue.
  exclude_from_revenue boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create trigger admin_plan_simulations_set_updated_at
  before update on public.admin_plan_simulations
  for each row execute function public.set_updated_at();

create index admin_plan_simulations_user_active_idx
  on public.admin_plan_simulations (user_id, starts_at desc)
  where revoked_at is null;

create index admin_plan_simulations_user_ends_idx
  on public.admin_plan_simulations (user_id, ends_at)
  where revoked_at is null;

alter table public.admin_entitlement_grants enable row level security;
alter table public.admin_plan_simulations enable row level security;
-- No authenticated policies: only service_role (bypasses RLS) may read/write.

grant all on public.admin_entitlement_grants to service_role;
grant all on public.admin_plan_simulations to service_role;
