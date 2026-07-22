-- Cortaix promotions system.
-- Separates price discounts from entitlement/usage bonuses.
-- Price discounts may map to Stripe coupons in live mode only.
-- Usage bonuses always remain first-party (never Stripe objects).
-- Service-role mutations; authenticated users may read their own redemptions.

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (char_length(trim(slug)) >= 2 and char_length(slug) <= 80),
  name text not null
    check (char_length(trim(name)) >= 1 and char_length(name) <= 200),
  description text
    check (description is null or char_length(description) <= 2000),
  -- draft | active | paused | ended | archived
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'ended', 'archived')),
  -- public_code = redeemable code; automatic = applied by eligibility rules
  distribution text not null
    check (distribution in ('public_code', 'automatic')),
  -- Normalized uppercase code for public promotions (null for automatic).
  code text
    check (code is null or (char_length(code) >= 3 and char_length(code) <= 64)),
  starts_at timestamptz not null,
  ends_at timestamptz,
  paused_at timestamptz,
  -- Global redemption cap (null = unlimited).
  max_redemptions integer
    check (max_redemptions is null or max_redemptions > 0),
  -- Per-user redemption cap.
  max_redemptions_per_user integer not null default 1
    check (max_redemptions_per_user > 0),
  -- Empty array = all plans. Otherwise restrict to listed launch plans.
  eligible_plans text[] not null default '{}'::text[],
  -- all | new_users | existing_users
  audience text not null default 'all'
    check (audience in ('all', 'new_users', 'existing_users')),
  -- Price discount effect (percentage / fixed / trial / limited periods).
  -- Null when the promotion is bonus-only.
  price_effect jsonb,
  -- Entitlement / usage bonus effect (turns, credits, storage, features).
  -- Null when the promotion is price-discount-only.
  bonus_effect jsonb,
  -- Stripe coupon / promotion code ids (live mode only; never set in demo).
  stripe_coupon_id text,
  stripe_promotion_code_id text,
  -- Demo mode stores a simulated Stripe mapping snapshot instead of calling Stripe.
  demo_stripe_simulation jsonb,
  redemption_count integer not null default 0
    check (redemption_count >= 0),
  reason text not null
    check (char_length(trim(reason)) >= 3),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (
    (distribution = 'public_code' and code is not null)
    or (distribution = 'automatic' and code is null)
  ),
  check (
    price_effect is not null
    or bonus_effect is not null
  ),
  check (
    price_effect is null
    or jsonb_typeof(price_effect) = 'object'
  ),
  check (
    bonus_effect is null
    or jsonb_typeof(bonus_effect) = 'object'
  ),
  check (
    (status <> 'paused' and paused_at is null)
    or (status = 'paused' and paused_at is not null)
  )
);

create unique index promotions_code_unique_idx
  on public.promotions (code)
  where code is not null;

create index promotions_status_window_idx
  on public.promotions (status, starts_at, ends_at);

create index promotions_distribution_idx
  on public.promotions (distribution, status);

create trigger promotions_set_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

create table public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  -- code | automatic | admin
  source text not null
    check (source in ('code', 'automatic', 'admin')),
  code_used text,
  -- applied | expired | revoked
  status text not null default 'applied'
    check (status in ('applied', 'expired', 'revoked')),
  expires_at timestamptz,
  revoked_at timestamptz,
  -- Snapshots of effects applied at redemption time.
  price_discount_applied jsonb,
  bonus_applied jsonb,
  -- Live Stripe ids when a price discount was mapped; null in demo.
  stripe_coupon_id text,
  stripe_promotion_code_id text,
  -- True when commercial mode was demo and Stripe objects were simulated.
  demo_simulated boolean not null default false,
  -- Link to entitlement grant created for bonus effects (optional).
  entitlement_grant_id uuid references public.admin_entitlement_grants (id)
    on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status <> 'revoked' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create trigger promotion_redemptions_set_updated_at
  before update on public.promotion_redemptions
  for each row execute function public.set_updated_at();

create index promotion_redemptions_user_idx
  on public.promotion_redemptions (user_id, redeemed_at desc);

create index promotion_redemptions_promo_idx
  on public.promotion_redemptions (promotion_id, redeemed_at desc);

create index promotion_redemptions_user_active_idx
  on public.promotion_redemptions (user_id, status, expires_at)
  where status = 'applied';

-- Atomic redeem: enforce window, pause, caps, then insert + bump counter.
create or replace function public.redeem_promotion(
  p_promotion_id uuid,
  p_user_id uuid,
  p_source text,
  p_code_used text default null,
  p_expires_at timestamptz default null,
  p_price_discount_applied jsonb default null,
  p_bonus_applied jsonb default null,
  p_stripe_coupon_id text default null,
  p_stripe_promotion_code_id text default null,
  p_demo_simulated boolean default false,
  p_entitlement_grant_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.promotion_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  promo public.promotions%rowtype;
  redemption public.promotion_redemptions%rowtype;
  user_count integer;
  now_ts timestamptz := now();
begin
  if p_source not in ('code', 'automatic', 'admin') then
    raise exception 'invalid_redemption_source';
  end if;

  select * into promo
  from public.promotions
  where id = p_promotion_id
  for update;

  if not found then
    raise exception 'promotion_not_found';
  end if;

  if promo.status = 'paused' then
    raise exception 'promotion_paused';
  end if;

  if promo.status <> 'active' then
    raise exception 'promotion_not_active';
  end if;

  if promo.starts_at > now_ts then
    raise exception 'promotion_not_started';
  end if;

  if promo.ends_at is not null and promo.ends_at <= now_ts then
    raise exception 'promotion_ended';
  end if;

  if promo.max_redemptions is not null
     and promo.redemption_count >= promo.max_redemptions then
    raise exception 'promotion_exhausted';
  end if;

  select count(*)::integer into user_count
  from public.promotion_redemptions
  where promotion_id = p_promotion_id
    and user_id = p_user_id
    and status = 'applied';

  if user_count >= promo.max_redemptions_per_user then
    raise exception 'promotion_user_limit';
  end if;

  insert into public.promotion_redemptions (
    promotion_id,
    user_id,
    source,
    code_used,
    status,
    expires_at,
    price_discount_applied,
    bonus_applied,
    stripe_coupon_id,
    stripe_promotion_code_id,
    demo_simulated,
    entitlement_grant_id,
    metadata
  ) values (
    p_promotion_id,
    p_user_id,
    p_source,
    p_code_used,
    'applied',
    p_expires_at,
    p_price_discount_applied,
    p_bonus_applied,
    p_stripe_coupon_id,
    p_stripe_promotion_code_id,
    coalesce(p_demo_simulated, false),
    p_entitlement_grant_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into redemption;

  update public.promotions
  set redemption_count = redemption_count + 1
  where id = p_promotion_id;

  return redemption;
end;
$$;

revoke all on function public.redeem_promotion(
  uuid, uuid, text, text, timestamptz, jsonb, jsonb, text, text, boolean, uuid, jsonb
) from public;
grant execute on function public.redeem_promotion(
  uuid, uuid, text, text, timestamptz, jsonb, jsonb, text, text, boolean, uuid, jsonb
) to service_role;

alter table public.promotions enable row level security;
alter table public.promotion_redemptions enable row level security;

-- Staff/admin mutations go through service role. Authenticated users can read
-- their own redemption history (e.g. plan page).
create policy "Users read own promotion redemptions"
  on public.promotion_redemptions
  for select
  to authenticated
  using (auth.uid() = user_id);
