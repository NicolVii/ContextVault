-- Admin Plan Editor: version metadata, model-family access, campaign overrides.
-- Mutations remain service-role only; authenticated clients keep read of
-- active public catalog rows.

-- ---------------------------------------------------------------------------
-- plan_versions: reason, actor, product snapshot for rollback
-- ---------------------------------------------------------------------------
alter table public.plan_versions
  add column if not exists change_reason text,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists product_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists superseded_version_id uuid
    references public.plan_versions (id) on delete set null;

alter table public.plan_versions
  drop constraint if exists plan_versions_product_snapshot_object;

alter table public.plan_versions
  add constraint plan_versions_product_snapshot_object
  check (jsonb_typeof(product_snapshot) = 'object');

comment on column public.plan_versions.change_reason is
  'Mandatory operator reason when publishing or rolling back a version.';
comment on column public.plan_versions.product_snapshot is
  'Pricing / visibility / feature-copy snapshot applied when this version is active.';
comment on column public.plan_versions.superseded_version_id is
  'Prior active version retired when this version was published (rollback target).';

-- Seed product snapshots for launch versions (matches plans rows).
update public.plan_versions v
set product_snapshot = jsonb_build_object(
  'label', p.label,
  'purpose', p.purpose,
  'amountEurCentsMonthly', p.amount_eur_cents_monthly,
  'amountEurCentsAnnual', p.amount_eur_cents_annual,
  'foundingEurCentsMonthly', p.founding_eur_cents_monthly,
  'stripePriceEnvMonthly', p.stripe_price_env_monthly,
  'stripePriceEnvAnnual', p.stripe_price_env_annual,
  'features', p.features,
  'public', p.public
),
change_reason = coalesce(v.change_reason, 'Launch seed')
from public.plans p
where p.id = v.plan_id
  and v.version = 1
  and (v.product_snapshot = '{}'::jsonb or v.product_snapshot is null);

-- ---------------------------------------------------------------------------
-- plan_entitlements: model-family access
-- ---------------------------------------------------------------------------
alter table public.plan_entitlements
  add column if not exists model_families jsonb not null default '[]'::jsonb;

alter table public.plan_entitlements
  drop constraint if exists plan_entitlements_model_families_array;

alter table public.plan_entitlements
  add constraint plan_entitlements_model_families_array
  check (jsonb_typeof(model_families) = 'array');

comment on column public.plan_entitlements.model_families is
  'Allowed frontier model-family ids (e.g. openai, anthropic, google, meta).';

-- Launch defaults: Free has no frontier families; Lite/Pro get the full set.
update public.plan_entitlements e
set model_families = '[]'::jsonb
from public.plan_versions v
where e.plan_version_id = v.id
  and v.plan_id = 'free'
  and e.model_families = '[]'::jsonb;

update public.plan_entitlements e
set model_families = '["openai","anthropic","google","meta"]'::jsonb
from public.plan_versions v
where e.plan_version_id = v.id
  and v.plan_id in ('lite', 'pro')
  and e.model_families = '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- plan_campaign_overrides: temporary entitlement overlays
-- ---------------------------------------------------------------------------
create table if not exists public.plan_campaign_overrides (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans (id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 1),
  reason text not null check (char_length(trim(reason)) >= 3),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Partial entitlement overrides; only present keys apply on top of the
  -- active plan version (e.g. {"frontierMonthlyTurns": 25}).
  entitlement_overrides jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (jsonb_typeof(entitlement_overrides) = 'object')
);

create index if not exists plan_campaign_overrides_plan_window_idx
  on public.plan_campaign_overrides (plan_id, starts_at, ends_at)
  where revoked_at is null;

create index if not exists plan_campaign_overrides_active_idx
  on public.plan_campaign_overrides (plan_id)
  where revoked_at is null;

comment on table public.plan_campaign_overrides is
  'Temporary plan-wide entitlement overlays (campaigns) with start/end dates. '
  'Does not permanently change plan_versions.';

alter table public.plan_campaign_overrides enable row level security;

-- No authenticated policies — service_role only (admin console).
grant all on public.plan_campaign_overrides to service_role;
