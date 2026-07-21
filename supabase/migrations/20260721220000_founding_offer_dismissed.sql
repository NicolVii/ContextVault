-- One-time founding Pro offer dismissal flag on billing_settings.

alter table public.billing_settings
  add column if not exists founding_offer_dismissed boolean not null default false;

comment on column public.billing_settings.founding_offer_dismissed is
  'When true, the post-login founding Pro offer is never shown again.';
