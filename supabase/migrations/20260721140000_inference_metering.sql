-- Cortaix inference foundation: usage metering + credit wallet + price book
-- Provider-agnostic ledger; OpenRouter is only one possible adapter.

-- ---------------------------------------------------------------------------
-- Price book (manual curated rows; versioned)
-- ---------------------------------------------------------------------------
create table public.price_book (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  version int not null default 1,
  input_credits_per_1k int not null,
  output_credits_per_1k int not null,
  min_credits int not null default 1,
  provider_input_usd_per_1m_micros bigint not null default 0,
  provider_output_usd_per_1m_micros bigint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (model_id, version)
);

comment on table public.price_book is 'Cortaix credit price book per logical model id.';

insert into public.price_book (
  model_id, version,
  input_credits_per_1k, output_credits_per_1k, min_credits,
  provider_input_usd_per_1m_micros, provider_output_usd_per_1m_micros
) values
  ('openai.gpt-4o-mini', 1, 20, 80, 10, 150000, 600000),
  ('openai.gpt-4o', 1, 350, 1400, 50, 2500000, 10000000),
  ('anthropic.claude-3.5-sonnet', 1, 400, 2000, 60, 3000000, 15000000),
  ('google.gemini-flash-1.5', 1, 15, 60, 8, 75000, 300000),
  ('meta.llama-3.1-70b-instruct', 1, 50, 80, 15, 400000, 400000);

-- ---------------------------------------------------------------------------
-- Usage events (append-only, idempotent on request_id)
-- ---------------------------------------------------------------------------
create table public.usage_events (
  request_id uuid primary key,
  tenant_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null,
  model_id text not null,
  provider text not null,
  provider_model_id text not null,
  billing_mode text not null check (billing_mode in ('platform', 'byok')),
  input_tokens int,
  output_tokens int,
  total_tokens int,
  embedding_units int,
  image_units int,
  measures_source text not null check (measures_source in ('provider', 'estimated', 'normalized')),
  provider_cost_usd_micros bigint not null default 0,
  credits_charged int not null default 0,
  price_book_version int not null default 1,
  created_at timestamptz not null default now()
);

create index usage_events_user_id_idx on public.usage_events (user_id, created_at desc);
create index usage_events_tenant_id_idx on public.usage_events (tenant_id, created_at desc);

comment on table public.usage_events is 'Provider-independent inference usage ledger.';

-- ---------------------------------------------------------------------------
-- Credit accounts + ledger
-- ---------------------------------------------------------------------------
create table public.credit_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid references public.usage_events (request_id) on delete set null,
  delta int not null,
  reason text not null,
  balance_after int not null,
  created_at timestamptz not null default now()
);

create index credit_ledger_user_id_idx on public.credit_ledger (user_id, created_at desc);

create trigger credit_accounts_set_updated_at
  before update on public.credit_accounts
  for each row execute function public.set_updated_at();

-- Atomically apply a credit delta (positive grant or negative usage debit).
create or replace function public.apply_credit_delta(
  p_user_id uuid,
  p_delta int,
  p_request_id uuid,
  p_reason text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  insert into public.credit_accounts (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  update public.credit_accounts
  set balance = balance + p_delta,
      updated_at = now()
  where user_id = p_user_id
    and balance + p_delta >= 0
  returning balance into v_balance;

  if v_balance is null then
    raise exception 'insufficient credits for user %', p_user_id
      using errcode = 'P0001';
  end if;

  insert into public.credit_ledger (user_id, request_id, delta, reason, balance_after)
  values (p_user_id, p_request_id, p_delta, p_reason, v_balance);

  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- Migrate product defaults to logical model ids
-- ---------------------------------------------------------------------------
alter table public.profiles
  alter column default_model set default 'openai.gpt-4o-mini';

update public.profiles
set default_model = replace(default_model, '/', '.')
where default_model like '%/%';

-- meta-llama special case: legacy id uses a hyphenated org segment
update public.profiles
set default_model = 'meta.llama-3.1-70b-instruct'
where default_model in (
  'meta-llama.llama-3.1-70b-instruct',
  'meta-llama/llama-3.1-70b-instruct'
);

alter table public.chat_sessions
  alter column model set default 'openai.gpt-4o-mini';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.usage_events enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.price_book enable row level security;

create policy "usage_events_select_own" on public.usage_events
  for select using (auth.uid() = user_id);

create policy "credit_accounts_select_own" on public.credit_accounts
  for select using (auth.uid() = user_id);

create policy "credit_ledger_select_own" on public.credit_ledger
  for select using (auth.uid() = user_id);

create policy "price_book_select_authenticated" on public.price_book
  for select to authenticated using (active = true);

-- Writes go through the service role (metering / grants).
