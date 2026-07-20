-- Context Vault — chat sessions, messages and the context provenance table
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  model text not null default 'openai/gpt-4o-mini',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_sessions_user_id_idx on public.chat_sessions (user_id);

create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_updated_at();

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,
  created_at timestamptz not null default now()
);

create index chat_messages_session_id_idx on public.chat_messages (session_id, created_at);
create index chat_messages_user_id_idx on public.chat_messages (user_id);

-- Provenance: which memories / document chunks were injected into a given
-- assistant response. Powers "Why does the AI know this?".
create table public.message_context (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  memory_id uuid references public.memories (id) on delete set null,
  document_chunk_id uuid references public.document_chunks (id) on delete set null,
  relevance real,
  created_at timestamptz not null default now()
);

create index message_context_message_id_idx on public.message_context (message_id);
create index message_context_user_id_idx on public.message_context (user_id);
