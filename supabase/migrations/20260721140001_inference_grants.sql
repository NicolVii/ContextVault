-- Grants for inference metering tables
grant select on
  public.usage_events,
  public.credit_accounts,
  public.credit_ledger,
  public.price_book
to authenticated;

grant all on
  public.usage_events,
  public.credit_accounts,
  public.credit_ledger,
  public.price_book
to service_role;

grant execute on function public.apply_credit_delta(uuid, int, uuid, text) to service_role;
