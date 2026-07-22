-- Platform operational controls + registration gate.
-- Controls are service-role managed; product APIs enforce them server-side.

create table public.system_operational_controls (
  key text primary key
    check (
      key in (
        'maintenance_mode',
        'mock_only_mode',
        'frontier_shutdown',
        'file_upload_shutdown',
        'voice_shutdown',
        'registration_shutdown',
        'checkout_shutdown',
        'provider_shutdown',
        'model_shutdown'
      )
    ),
  enabled boolean not null default false,
  expires_at timestamptz,
  reason text,
  -- For provider_shutdown / model_shutdown: empty = all; else targeted ids.
  target_ids text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.system_operational_controls is
  'Audited platform kill-switches. Expiry is optional; enforcement is server-side.';

create trigger system_operational_controls_set_updated_at
  before update on public.system_operational_controls
  for each row execute function public.set_updated_at();

alter table public.system_operational_controls enable row level security;
-- No authenticated policies: service_role only.

insert into public.system_operational_controls (key, enabled) values
  ('maintenance_mode', false),
  ('mock_only_mode', false),
  ('frontier_shutdown', false),
  ('file_upload_shutdown', false),
  ('voice_shutdown', false),
  ('registration_shutdown', false),
  ('checkout_shutdown', false),
  ('provider_shutdown', false),
  ('model_shutdown', false);

-- Block new auth users while registration_shutdown is active (and not expired).
create or replace function public.enforce_registration_shutdown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ctl_enabled boolean;
  ctl_expires timestamptz;
begin
  select c.enabled, c.expires_at
    into ctl_enabled, ctl_expires
  from public.system_operational_controls c
  where c.key = 'registration_shutdown';

  if coalesce(ctl_enabled, false)
     and (ctl_expires is null or ctl_expires > now()) then
    raise exception 'Registration is temporarily disabled'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger enforce_registration_shutdown_on_auth_users
  before insert on auth.users
  for each row execute function public.enforce_registration_shutdown();

comment on function public.enforce_registration_shutdown() is
  'Rejects auth.users inserts while registration_shutdown control is active.';
