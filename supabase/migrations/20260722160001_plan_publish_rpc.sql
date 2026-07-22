-- Atomic plan version publish: retire current active, insert next version +
-- entitlements, apply product snapshot to plans. Avoids a window with no
-- active version when multi-step client writes fail mid-flight.

create or replace function public.admin_publish_plan_version(
  p_plan_id text,
  p_change_reason text,
  p_created_by uuid,
  p_effective_from timestamptz,
  p_product_snapshot jsonb,
  p_entitlements jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
  v_prev uuid;
  v_new uuid;
  v_unlimited boolean;
  v_auto_turns integer;
begin
  if p_plan_id is null or p_plan_id !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'invalid plan id';
  end if;
  if p_change_reason is null or char_length(trim(p_change_reason)) < 3 then
    raise exception 'change reason required';
  end if;
  if jsonb_typeof(p_product_snapshot) is distinct from 'object' then
    raise exception 'product_snapshot must be an object';
  end if;
  if jsonb_typeof(p_entitlements) is distinct from 'object' then
    raise exception 'entitlements must be an object';
  end if;

  v_auto_turns := nullif(p_entitlements->>'auto_monthly_turns', '')::integer;
  v_unlimited := coalesce((p_entitlements->>'unlimited_auto')::boolean, false);
  if (v_unlimited and v_auto_turns is not null)
     or (not v_unlimited and v_auto_turns is null) then
    raise exception 'unlimited_auto must match null auto_monthly_turns';
  end if;

  select version into v_next
  from public.plan_versions
  where plan_id = p_plan_id
  order by version desc
  limit 1;
  v_next := coalesce(v_next, 0) + 1;

  select id into v_prev
  from public.plan_versions
  where plan_id = p_plan_id and status = 'active'
  limit 1;

  if v_prev is not null then
    update public.plan_versions
    set status = 'retired'
    where id = v_prev;
  end if;

  insert into public.plan_versions (
    plan_id,
    version,
    status,
    effective_from,
    change_reason,
    created_by,
    product_snapshot,
    superseded_version_id,
    notes
  ) values (
    p_plan_id,
    v_next,
    'active',
    coalesce(p_effective_from, now()),
    trim(p_change_reason),
    p_created_by,
    p_product_snapshot,
    v_prev,
    trim(p_change_reason)
  )
  returning id into v_new;

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
    elevated_limits,
    model_families
  ) values (
    v_new,
    v_auto_turns,
    v_unlimited,
    coalesce((p_entitlements->>'auto_fair_use_daily_credits')::integer, 0),
    coalesce((p_entitlements->>'auto_fair_use_period_credits')::integer, 0),
    nullif(p_entitlements->>'frontier_monthly_turns', '')::integer,
    coalesce((p_entitlements->>'max_frontier_credits_per_turn')::integer, 0),
    nullif(p_entitlements->>'frontier_soft_credit_cap', '')::integer,
    coalesce((p_entitlements->>'frontier_heavy_ratio')::double precision, 0.8),
    coalesce((p_entitlements->>'attachments')::boolean, false),
    coalesce((p_entitlements->>'storage_bytes')::bigint, 0),
    coalesce((p_entitlements->>'byok')::boolean, false),
    coalesce((p_entitlements->>'voice')::boolean, false),
    coalesce((p_entitlements->>'elevated_limits')::boolean, false),
    coalesce(p_entitlements->'model_families', '[]'::jsonb)
  );

  update public.plans
  set
    label = coalesce(p_product_snapshot->>'label', label),
    purpose = coalesce(p_product_snapshot->>'purpose', purpose),
    amount_eur_cents_monthly = coalesce(
      (p_product_snapshot->>'amountEurCentsMonthly')::integer,
      amount_eur_cents_monthly
    ),
    amount_eur_cents_annual = case
      when p_product_snapshot ? 'amountEurCentsAnnual'
        then nullif(p_product_snapshot->>'amountEurCentsAnnual', '')::integer
      else amount_eur_cents_annual
    end,
    founding_eur_cents_monthly = case
      when p_product_snapshot ? 'foundingEurCentsMonthly'
        then nullif(p_product_snapshot->>'foundingEurCentsMonthly', '')::integer
      else founding_eur_cents_monthly
    end,
    stripe_price_env_monthly = case
      when p_product_snapshot ? 'stripePriceEnvMonthly'
        then nullif(p_product_snapshot->>'stripePriceEnvMonthly', '')
      else stripe_price_env_monthly
    end,
    stripe_price_env_annual = case
      when p_product_snapshot ? 'stripePriceEnvAnnual'
        then nullif(p_product_snapshot->>'stripePriceEnvAnnual', '')
      else stripe_price_env_annual
    end,
    features = coalesce(p_product_snapshot->'features', features),
    public = coalesce((p_product_snapshot->>'public')::boolean, public)
  where id = p_plan_id;

  return v_new;
end;
$$;

revoke all on function public.admin_publish_plan_version(
  text, text, uuid, timestamptz, jsonb, jsonb
) from public;
grant execute on function public.admin_publish_plan_version(
  text, text, uuid, timestamptz, jsonb, jsonb
) to service_role;

comment on function public.admin_publish_plan_version is
  'Atomically publish a new active plan version with entitlements + product snapshot.';
