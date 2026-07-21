-- Pinning for memories (Stage 2)
alter table public.memories
  add column if not exists pinned_at timestamptz;

create index if not exists memories_pinned_at_idx
  on public.memories (user_id, pinned_at desc nulls last);
