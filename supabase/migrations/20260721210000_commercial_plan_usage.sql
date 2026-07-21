-- Commercial experience: plan usage periods, billing settings, period grant idempotency.
-- Extensible for future qualitative tiers; launch plans are free / lite / pro.

-- ---------------------------------------------------------------------------
-- Plan usage periods (Auto / Frontier counters + internal credit soft caps)
-- ---------------------------------------------------------------------------
create table public.plan_usage_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null default 'free',
  period_start timestamptz not null,
  period_end timestamptz not null,
  auto_turns int not null default 0 check (auto_turns >= 0),
  frontier_turns int not null default 0 check (frontier_turns >= 0),
  auto_credits int not null default 0 check (auto_credits >= 0),
  frontier_credits int not null default 0 check (frontier_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create index plan_usage_periods_user_idx
  on public.plan_usage_periods (user_id, period_start desc);

create trigger plan_usage_periods_set_updated_at
  before update on public.plan_usage_periods
  for each row execute function public.set_updated_at();

comment on table public.plan_usage_periods is
  'Per-period Auto/Frontier usage counters for Free/Lite/Pro entitlements.';

-- ---------------------------------------------------------------------------
-- Subscription period grants (idempotent invoice → grant)
-- ---------------------------------------------------------------------------
create table public.subscription_period_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_subscription_id text not null,
  period_start timestamptz not null,
  plan_id text not null,
  created_at timestamptz not null default now(),
  unique (stripe_subscription_id, period_start)
);

create index subscription_period_grants_user_idx
  on public.subscription_period_grants (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Billing settings (spend caps / optional auto top-up — off by default)
-- ---------------------------------------------------------------------------
create table public.billing_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  monthly_spend_cap_eur_cents int check (monthly_spend_cap_eur_cents is null or monthly_spend_cap_eur_cents >= 0),
  auto_topup_enabled boolean not null default false,
  auto_topup_pack_id text,
  grace_period_ends_at timestamptz,
  inference_restricted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger billing_settings_set_updated_at
  before update on public.billing_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Commercial telemetry (aggregate-friendly event log for future tier decisions)
-- ---------------------------------------------------------------------------
create table public.billing_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_name text not null,
  plan_id text,
  intensity text,
  model_id text,
  credits int,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index billing_telemetry_events_created_idx
  on public.billing_telemetry_events (created_at desc);
create index billing_telemetry_events_name_idx
  on public.billing_telemetry_events (event_name, created_at desc);

-- ---------------------------------------------------------------------------
-- Atomically record a plan usage turn (returns false if entitlement would break)
-- ---------------------------------------------------------------------------
create or replace function public.record_plan_usage_turn(
  p_user_id uuid,
  p_plan_id text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_intensity text,
  p_credits int,
  p_max_auto_turns int,
  p_max_frontier_turns int,
  p_max_auto_credits int,
  p_max_frontier_credits int,
  p_max_credits_per_turn int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.plan_usage_periods%rowtype;
  v_credits int := greatest(0, p_credits);
begin
  if p_intensity not in ('auto', 'frontier') then
    raise exception 'invalid intensity %', p_intensity using errcode = 'P0001';
  end if;

  if p_max_credits_per_turn > 0 and v_credits > p_max_credits_per_turn then
    return false;
  end if;

  insert into public.plan_usage_periods (
    user_id, plan_id, period_start, period_end
  ) values (
    p_user_id, p_plan_id, p_period_start, p_period_end
  )
  on conflict (user_id, period_start) do nothing;

  select * into v_row
  from public.plan_usage_periods
  where user_id = p_user_id and period_start = p_period_start
  for update;

  if p_intensity = 'auto' then
    if p_max_auto_turns is not null and v_row.auto_turns >= p_max_auto_turns then
      return false;
    end if;
    if p_max_auto_credits is not null and v_row.auto_credits + v_credits > p_max_auto_credits then
      return false;
    end if;
    update public.plan_usage_periods
    set auto_turns = auto_turns + 1,
        auto_credits = auto_credits + v_credits,
        plan_id = p_plan_id,
        period_end = p_period_end,
        updated_at = now()
    where id = v_row.id;
  else
    if p_max_frontier_turns is not null and v_row.frontier_turns >= p_max_frontier_turns then
      return false;
    end if;
    if p_max_frontier_credits is not null
       and v_row.frontier_credits + v_credits > p_max_frontier_credits then
      return false;
    end if;
    update public.plan_usage_periods
    set frontier_turns = frontier_turns + 1,
        frontier_credits = frontier_credits + v_credits,
        plan_id = p_plan_id,
        period_end = p_period_end,
        updated_at = now()
    where id = v_row.id;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.plan_usage_periods enable row level security;
alter table public.subscription_period_grants enable row level security;
alter table public.billing_settings enable row level security;
alter table public.billing_telemetry_events enable row level security;

create policy "plan_usage_periods_select_own" on public.plan_usage_periods
  for select using (auth.uid() = user_id);

create policy "billing_settings_select_own" on public.billing_settings
  for select using (auth.uid() = user_id);

create policy "billing_settings_update_own" on public.billing_settings
  for update using (auth.uid() = user_id);

create policy "billing_settings_insert_own" on public.billing_settings
  for insert with check (auth.uid() = user_id);

-- Grants: service role full; authenticated read own where applicable
grant select on public.plan_usage_periods to authenticated;
grant select, insert, update on public.billing_settings to authenticated;
grant all on public.plan_usage_periods to service_role;
grant all on public.subscription_period_grants to service_role;
grant all on public.billing_settings to service_role;
grant all on public.billing_telemetry_events to service_role;
grant execute on function public.record_plan_usage_turn to service_role;
