-- Context Vault — Data API grants
-- Recent Supabase no longer auto-exposes new public tables to the PostgREST
-- roles. RLS still governs *which rows* each user sees; these grants govern
-- *table access* for the roles. Without them every API query fails with
-- "permission denied for table".

grant usage on schema public to anon, authenticated, service_role;

-- End-user role (anon key + user JWT). RLS policies restrict rows to the user.
grant select, insert, update, delete on
  public.profiles,
  public.memories,
  public.documents,
  public.document_chunks,
  public.chat_sessions,
  public.chat_messages,
  public.message_context
to authenticated;

grant select on public.audit_log to authenticated;

-- Service role (server-only, bypasses RLS) — used for auditing, rate limiting
-- and background writes.
grant all on all tables in schema public to service_role;

grant execute on function public.increment_rate_limit(uuid, text, int) to service_role;
grant execute on function public.match_memories(vector, int, memory_type[]) to authenticated, service_role;
grant execute on function public.match_document_chunks(vector, int) to authenticated, service_role;
