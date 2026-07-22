-- Platform administrator roles (distinct from workspace_members.role).
-- Authorization is enforced server-side via service-role reads; authenticated
-- users may only SELECT their own row and cannot elevate themselves.

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user'
    check (role in ('user', 'support', 'admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_roles_set_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

alter table public.user_roles enable row level security;

create policy "user_roles_select_own" on public.user_roles
  for select using (auth.uid() = user_id);

-- Provision a default role row whenever an auth user is created.
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- Backfill existing users.
insert into public.user_roles (user_id, role)
select id, 'user' from auth.users
on conflict (user_id) do nothing;

-- Dedicated admin action audit trail (service-role writes only).
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_actor_created_idx
  on public.admin_audit_log (actor_user_id, created_at desc);

create index admin_audit_log_action_created_idx
  on public.admin_audit_log (action, created_at desc);

alter table public.admin_audit_log enable row level security;
-- No authenticated policies: only service_role (bypasses RLS) may read/write.

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant all on public.admin_audit_log to service_role;
