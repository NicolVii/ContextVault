-- Context Vault — documents and searchable chunks
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  page_count int,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index documents_user_id_idx on public.documents (user_id);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  page_number int,
  chunk_index int not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index document_chunks_user_id_idx on public.document_chunks (user_id);
create index document_chunks_document_id_idx on public.document_chunks (document_id);
create index document_chunks_embedding_idx on public.document_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
