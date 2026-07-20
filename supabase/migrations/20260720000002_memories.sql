-- Context Vault — memories
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 8000),
  category text,
  type memory_type not null default 'semantic',
  source memory_source not null default 'manual',
  source_detail text,
  confidence real not null default 1.0 check (confidence >= 0 and confidence <= 1),
  status memory_status not null default 'active',
  is_sensitive boolean not null default false,
  embedding vector(1536),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.memories is 'User memories. Automatically-extracted memories start as proposed and must be reviewed.';

create index memories_user_id_idx on public.memories (user_id);
create index memories_status_idx on public.memories (user_id, status);
create index memories_type_idx on public.memories (user_id, type);
-- Approximate nearest neighbour index for semantic retrieval (cosine distance).
create index memories_embedding_idx on public.memories
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create trigger memories_set_updated_at
  before update on public.memories
  for each row execute function public.set_updated_at();
