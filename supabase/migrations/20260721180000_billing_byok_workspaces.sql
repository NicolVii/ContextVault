-- Commercial billing: Stripe customers + subscriptions

create table public.stripe_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_id text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.stripe_customers enable row level security;
alter table public.subscriptions enable row level security;

create policy "stripe_customers_select_own" on public.stripe_customers
  for select using (auth.uid() = user_id);

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- BYOK encrypted provider keys
create table public.user_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  ciphertext text not null,
  iv text not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create trigger user_provider_keys_set_updated_at
  before update on public.user_provider_keys
  for each row execute function public.set_updated_at();

alter table public.user_provider_keys enable row level security;

create policy "user_provider_keys_select_own" on public.user_provider_keys
  for select using (auth.uid() = user_id);
create policy "user_provider_keys_insert_own" on public.user_provider_keys
  for insert with check (auth.uid() = user_id);
create policy "user_provider_keys_update_own" on public.user_provider_keys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_provider_keys_delete_own" on public.user_provider_keys
  for delete using (auth.uid() = user_id);

-- Personal workspaces (Phase 5 minimal tenancy)
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  default_model text not null default 'auto',
  monthly_credit_budget int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "workspaces_select_member" on public.workspaces
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = id and m.user_id = auth.uid()
    )
  );
create policy "workspaces_insert_own" on public.workspaces
  for insert with check (owner_id = auth.uid());
create policy "workspaces_update_own" on public.workspaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "workspaces_delete_own" on public.workspaces
  for delete using (owner_id = auth.uid());

create policy "workspace_members_select" on public.workspace_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );
create policy "workspace_members_owner_write" on public.workspace_members
  for all using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

grant select on public.stripe_customers, public.subscriptions to authenticated;
grant select, insert, update, delete on public.user_provider_keys to authenticated;
grant select, insert, update, delete on public.workspaces, public.workspace_members to authenticated;
grant all on public.stripe_customers, public.subscriptions, public.user_provider_keys, public.workspaces, public.workspace_members to service_role;
