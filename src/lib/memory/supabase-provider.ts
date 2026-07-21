import type { SupabaseClient } from "@supabase/supabase-js";
import type { Memory, RetrievedMemory } from "@/lib/types";
import { getEmbeddingProvider, toVectorLiteral } from "@/lib/embeddings";
import type { MemoryProvider, NewMemory, RetrieveOptions } from "./provider";

export class SupabaseMemoryProvider implements MemoryProvider {
  readonly name = "supabase";

  async insert(
    client: SupabaseClient,
    userId: string,
    memories: NewMemory[]
  ): Promise<Memory[]> {
    if (memories.length === 0) return [];
    const embedder = getEmbeddingProvider();
    const embeddings = await embedder.embed(memories.map((m) => m.content));

    const rows = memories.map((m, i) => ({
      user_id: userId,
      content: m.content,
      type: m.type,
      category: m.category ?? null,
      source: m.source,
      source_detail: m.source_detail ?? null,
      confidence: m.confidence ?? 1,
      is_sensitive: m.is_sensitive ?? false,
      status: m.status ?? "active",
      expires_at: m.expires_at ?? null,
      embedding: toVectorLiteral(embeddings[i]),
    }));

    const { data, error } = await client.from("memories").insert(rows).select();
    if (error) throw new Error(`Failed to insert memories: ${error.message}`);
    return data as Memory[];
  }

  async retrieve(
    client: SupabaseClient,
    _userId: string,
    query: string,
    options: RetrieveOptions = {}
  ): Promise<RetrievedMemory[]> {
    const embedder = getEmbeddingProvider();
    const [embedding] = await embedder.embed([query]);
    const { data, error } = await client.rpc("match_memories", {
      query_embedding: toVectorLiteral(embedding),
      match_count: options.limit ?? 8,
      filter_types: options.types ?? null,
    });
    if (error) throw new Error(`Retrieval failed: ${error.message}`);
    return (data ?? []) as RetrievedMemory[];
  }

  async reembed(
    client: SupabaseClient,
    memoryId: string,
    content: string
  ): Promise<void> {
    const embedder = getEmbeddingProvider();
    const [embedding] = await embedder.embed([content]);
    const { error } = await client
      .from("memories")
      .update({ embedding: toVectorLiteral(embedding) })
      .eq("id", memoryId);
    if (error) throw new Error(`Failed to re-embed memory: ${error.message}`);
  }

  async remove(): Promise<void> {
    // pgvector rows are removed when the Supabase row is deleted.
  }

  async syncMetadata(): Promise<void> {
    // Supabase is the only index for this provider.
  }

  async removeAll(): Promise<void> {
    // Supabase rows are removed by the caller.
  }
}
