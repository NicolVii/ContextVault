-- Grants for promotions tables (service_role mutations; authenticated read own redemptions).
grant all on public.promotions to service_role;
grant all on public.promotion_redemptions to service_role;

grant select on public.promotion_redemptions to authenticated;
