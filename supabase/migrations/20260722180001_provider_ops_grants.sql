-- Grants for provider ops tables (service_role only — no authenticated access).
grant all on
  public.inference_providers,
  public.inference_model_overrides,
  public.provider_health_checks,
  public.provider_ops_events
to service_role;
