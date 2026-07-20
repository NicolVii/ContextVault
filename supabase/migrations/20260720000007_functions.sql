-- Context Vault — semantic retrieval functions
-- These run as SECURITY INVOKER (default) and filter on auth.uid(), so with
-- RLS enabled a caller can only ever match their own rows.

create or replace function public.match_memories(
  query_embedding vector(1536),
  match_count int default 8,
  filter_types memory_type[] default null
)
returns table (
  id uuid,
  content text,
  category text,
  type memory_type,
  source memory_source,
  source_detail text,
  confidence real,
  created_at timestamptz,
  similarity real
)
language sql
stable
as $$
  select
    m.id,
    m.content,
    m.category,
    m.type,
    m.source,
    m.source_detail,
    m.confidence,
    m.created_at,
    (1 - (m.embedding <=> query_embedding))::real as similarity
  from public.memories m
  where m.user_id = auth.uid()
    and m.status = 'active'
    and m.embedding is not null
    and (m.expires_at is null or m.expires_at > now())
    and (filter_types is null or m.type = any (filter_types))
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  filename text,
  content text,
  page_number int,
  similarity real
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    d.filename,
    c.content,
    c.page_number,
    (1 - (c.embedding <=> query_embedding))::real as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.user_id = auth.uid()
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_memories(vector, int, memory_type[]) to authenticated;
grant execute on function public.match_document_chunks(vector, int) to authenticated;
