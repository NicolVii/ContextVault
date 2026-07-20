-- Context Vault — Row Level Security
-- Every table is locked down so a user can only ever see or mutate their own
-- rows. This is the primary defence for memory isolation.

alter table public.profiles enable row level security;
alter table public.memories enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.message_context enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

-- Profiles ------------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Memories ------------------------------------------------------------------
create policy "memories_select_own" on public.memories
  for select using (auth.uid() = user_id);
create policy "memories_insert_own" on public.memories
  for insert with check (auth.uid() = user_id);
create policy "memories_update_own" on public.memories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "memories_delete_own" on public.memories
  for delete using (auth.uid() = user_id);

-- Documents -----------------------------------------------------------------
create policy "documents_select_own" on public.documents
  for select using (auth.uid() = user_id);
create policy "documents_insert_own" on public.documents
  for insert with check (auth.uid() = user_id);
create policy "documents_update_own" on public.documents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "documents_delete_own" on public.documents
  for delete using (auth.uid() = user_id);

-- Document chunks -----------------------------------------------------------
create policy "document_chunks_select_own" on public.document_chunks
  for select using (auth.uid() = user_id);
create policy "document_chunks_insert_own" on public.document_chunks
  for insert with check (auth.uid() = user_id);
create policy "document_chunks_delete_own" on public.document_chunks
  for delete using (auth.uid() = user_id);

-- Chat sessions -------------------------------------------------------------
create policy "chat_sessions_select_own" on public.chat_sessions
  for select using (auth.uid() = user_id);
create policy "chat_sessions_insert_own" on public.chat_sessions
  for insert with check (auth.uid() = user_id);
create policy "chat_sessions_update_own" on public.chat_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chat_sessions_delete_own" on public.chat_sessions
  for delete using (auth.uid() = user_id);

-- Chat messages -------------------------------------------------------------
create policy "chat_messages_select_own" on public.chat_messages
  for select using (auth.uid() = user_id);
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (auth.uid() = user_id);
create policy "chat_messages_delete_own" on public.chat_messages
  for delete using (auth.uid() = user_id);

-- Message context -----------------------------------------------------------
create policy "message_context_select_own" on public.message_context
  for select using (auth.uid() = user_id);
create policy "message_context_insert_own" on public.message_context
  for insert with check (auth.uid() = user_id);

-- Audit log: users may read their own entries. Writes go through the service
-- role (which bypasses RLS), so no insert policy is granted to end users.
create policy "audit_log_select_own" on public.audit_log
  for select using (auth.uid() = user_id);

-- rate_limits has RLS enabled with no policies: only the service role and the
-- security-definer increment function may touch it.
