-- Database-backed plan catalog + versioned entitlements.
-- TypeScript defaults remain the safe fallback when rows are missing/malformed.
-- Authenticated clients may read active public catalog rows; mutations are
-- service-role only.

-- ---------------------------------------------------------------------------
-- plans (product catalog)
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key
    check (id ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  purpose text not null,
  amount_eur_cents_monthly integer not null
    check (amount_eur_cents_monthly >= 0),
  amount_eur_cents_annual integer
    check (amount_eur_cents_annual is null or amount_eur_cents_annual >= 0),
  founding_eur_cents_monthly integer
    check (
      founding_eur_cents_monthly is null
      or founding_eur_cents_monthly >= 0
    ),
  stripe_price_env_monthly text,
  stripe_price_env_annual text,
  features jsonb not null default '[]'::jsonb,
  public boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(features) = 'array')
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

comment on table public.plans is
  'Cortaix subscription plan catalog (Free / Lite / Pro + future).';

-- ---------------------------------------------------------------------------
-- plan_versions (versioned entitlement snapshots)
-- ---------------------------------------------------------------------------
create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans (id) on delete cascade,
  version integer not null check (version >= 1),
  status text not null default 'active'
    check (status in ('draft', 'active', 'retired')),
  effective_from timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  unique (plan_id, version)
);

-- At most one active version per plan.
create unique index plan_versions_one_active_per_plan
  on public.plan_versions (plan_id)
  where status = 'active';

create index plan_versions_plan_status_idx
  on public.plan_versions (plan_id, status);

comment on table public.plan_versions is
  'Versioned entitlement snapshots; only one active version per plan.';

-- ---------------------------------------------------------------------------
-- plan_entitlements (gates for a plan version)
-- ---------------------------------------------------------------------------
create table public.plan_entitlements (
  plan_version_id uuid primary key
    references public.plan_versions (id) on delete cascade,
  auto_monthly_turns integer
    check (auto_monthly_turns is null or auto_monthly_turns >= 0),
  unlimited_auto boolean not null,
  auto_fair_use_daily_credits integer not null
    check (auto_fair_use_daily_credits >= 0),
  auto_fair_use_period_credits integer not null
    check (auto_fair_use_period_credits >= 0),
  frontier_monthly_turns integer
    check (frontier_monthly_turns is null or frontier_monthly_turns >= 0),
  max_frontier_credits_per_turn integer not null
    check (max_frontier_credits_per_turn >= 0),
  frontier_soft_credit_cap integer
    check (
      frontier_soft_credit_cap is null
      or frontier_soft_credit_cap >= 0
    ),
  frontier_heavy_ratio double precision not null
    check (frontier_heavy_ratio >= 0 and frontier_heavy_ratio <= 1),
  attachments boolean not null,
  storage_bytes bigint not null check (storage_bytes >= 0),
  byok boolean not null,
  voice boolean not null,
  elevated_limits boolean not null,
  created_at timestamptz not null default now(),
  -- unlimited_auto must match null auto_monthly_turns (null = unlimited).
  check (
    (unlimited_auto = true and auto_monthly_turns is null)
    or (unlimited_auto = false and auto_monthly_turns is not null)
  )
);

comment on table public.plan_entitlements is
  'Product entitlement gates for a specific plan_versions row.';

-- ---------------------------------------------------------------------------
-- Seed launch Free / Lite / Pro (matches TypeScript defaults)
-- ---------------------------------------------------------------------------
insert into public.plans (
  id, label, purpose,
  amount_eur_cents_monthly, amount_eur_cents_annual, founding_eur_cents_monthly,
  stripe_price_env_monthly, stripe_price_env_annual,
  features, public, active, sort_order
) values
  (
    'free',
    'Free',
    'Keep your memory alive',
    0,
    null,
    null,
    null,
    null,
    '["About 30 Auto conversations / month","Persistent memory","Search, review, and export"]'::jsonb,
    true,
    true,
    0
  ),
  (
    'lite',
    'Lite',
    'Explore Cortaix affordably',
    500,
    5000,
    null,
    'STRIPE_PRICE_LITE_MONTHLY',
    'STRIPE_PRICE_LITE_ANNUAL',
    '["Unlimited Auto under fair use","About 10 Frontier conversations / month","100 MB file library","Export"]'::jsonb,
    true,
    true,
    1
  ),
  (
    'pro',
    'Pro',
    'The complete Cortaix experience',
    2800,
    28000,
    2500,
    'STRIPE_PRICE_PRO_MONTHLY',
    'STRIPE_PRICE_PRO_ANNUAL',
    '["Unlimited Auto","Generous Frontier access","Every frontier model family","Voice · BYOK · higher limits","Full memory intelligence"]'::jsonb,
    true,
    true,
    2
  );

insert into public.plan_versions (id, plan_id, version, status, notes)
values
  ('a0000000-0000-4000-8000-000000000001', 'free', 1, 'active', 'Launch Free entitlements'),
  ('a0000000-0000-4000-8000-000000000002', 'lite', 1, 'active', 'Launch Lite entitlements'),
  ('a0000000-0000-4000-8000-000000000003', 'pro', 1, 'active', 'Launch Pro entitlements');

insert into public.plan_entitlements (
  plan_version_id,
  auto_monthly_turns,
  unlimited_auto,
  auto_fair_use_daily_credits,
  auto_fair_use_period_credits,
  frontier_monthly_turns,
  max_frontier_credits_per_turn,
  frontier_soft_credit_cap,
  frontier_heavy_ratio,
  attachments,
  storage_bytes,
  byok,
  voice,
  elevated_limits
) values
  (
    'a0000000-0000-4000-8000-000000000001',
    30, false, 8000, 8000,
    0, 0, 0, 0.8,
    false, 0, false, false, false
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    null, true, 50000, 400000,
    10, 8000, null, 0.8,
    true, 104857600, false, false, false
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    null, true, 200000, 2000000,
    null, 50000, 400000, 0.8,
    true, 5368709120, true, true, true
  );

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.plan_versions enable row level security;
alter table public.plan_entitlements enable row level security;

create policy "plans_select_authenticated"
  on public.plans
  for select
  to authenticated
  using (active = true and public = true);

create policy "plan_versions_select_authenticated"
  on public.plan_versions
  for select
  to authenticated
  using (
    status = 'active'
    and exists (
      select 1
      from public.plans p
      where p.id = plan_id
        and p.active = true
        and p.public = true
    )
  );

create policy "plan_entitlements_select_authenticated"
  on public.plan_entitlements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.plan_versions v
      join public.plans p on p.id = v.plan_id
      where v.id = plan_version_id
        and v.status = 'active'
        and p.active = true
        and p.public = true
    )
  );

grant select on public.plans to authenticated;
grant select on public.plan_versions to authenticated;
grant select on public.plan_entitlements to authenticated;

grant all on public.plans to service_role;
grant all on public.plan_versions to service_role;
grant all on public.plan_entitlements to service_role;
