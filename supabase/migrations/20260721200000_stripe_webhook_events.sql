-- Stripe webhook idempotency: each event_id is processed at most once.
create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index stripe_webhook_events_processed_at_idx
  on public.stripe_webhook_events (processed_at desc);

alter table public.stripe_webhook_events enable row level security;
-- No end-user policies: service role only.

grant all on public.stripe_webhook_events to service_role;
