import type { SupabaseClient } from "@supabase/supabase-js";
import type { Memory, MemorySource, MemoryType, RetrievedMemory } from "@/lib/types";
import type { MemoryProvider, NewMemory, RetrieveOptions } from "./provider";
import { Mem0Client } from "./mem0/client";
import {
  buildMem0Metadata,
  parseMem0Id,
  toExpirationDate,
  withMem0Id,
} from "./mem0/mapping";

export interface Mem0MemoryProviderOptions {
  apiKey: string;
  baseUrl?: string;
  client?: Mem0Client;
}

/**
 * Hybrid memory provider: Supabase remains the canonical store for UI, review
 * queue, RLS and export; Mem0 owns semantic retrieval and embeddings.
 *
 * Each Supabase row is mirrored to Mem0 with `infer: false` (verbatim content)
 * and Context Vault metadata (`cv_memory_id`, type, status, …). The Mem0 id is
 * stored in `source_detail` as `mem0:<uuid>` for updates.
 */
export class Mem0MemoryProvider implements MemoryProvider {
  readonly name = "mem0";
  private readonly client: Mem0Client;

  constructor(apiKeyOrOptions: string | Mem0MemoryProviderOptions) {
    if (typeof apiKeyOrOptions === "string") {
      this.client = new Mem0Client({
        apiKey: apiKeyOrOptions,
        baseUrl: process.env.MEM0_API_BASE_URL,
      });
    } else {
      this.client =
        apiKeyOrOptions.client ??
        new Mem0Client({
          apiKey: apiKeyOrOptions.apiKey,
          baseUrl: apiKeyOrOptions.baseUrl ?? process.env.MEM0_API_BASE_URL,
        });
    }
  }

  async insert(
    client: SupabaseClient,
    userId: string,
    memories: NewMemory[]
  ): Promise<Memory[]> {
    if (memories.length === 0) return [];

    const rows = memories.map((m) => ({
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
      embedding: null,
    }));

    const { data, error } = await client.from("memories").insert(rows).select();
    if (error) throw new Error(`Failed to insert memories: ${error.message}`);

    const inserted = data as Memory[];
    const synced: Memory[] = [];

    for (let i = 0; i < inserted.length; i++) {
      const row = inserted[i];
      const input = memories[i];
      try {
        const mem0Id = await this.client.addMemory({
          userId,
          content: row.content,
          metadata: buildMem0Metadata(row.id, input),
          expirationDate: toExpirationDate(row.expires_at),
        });

        const sourceDetail = withMem0Id(row.source_detail, mem0Id);
        const { data: updated, error: updateError } = await client
          .from("memories")
          .update({ source_detail: sourceDetail })
          .eq("id", row.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to link Mem0 id: ${updateError.message}`);
        }
        synced.push(updated as Memory);
      } catch (err) {
        await client.from("memories").delete().eq("id", row.id);
        throw err instanceof Error ? err : new Error(String(err));
      }
    }

    return synced;
  }

  async retrieve(
    client: SupabaseClient,
    userId: string,
    query: string,
    options: RetrieveOptions = {}
  ): Promise<RetrievedMemory[]> {
    const hits = await this.client.searchMemories({
      userId,
      query,
      topK: options.limit ?? 8,
    });

    if (hits.length === 0) return [];

    const candidateIds = hits
      .map((hit) => hit.metadata?.cv_memory_id)
      .filter((id): id is string => typeof id === "string");

    if (candidateIds.length === 0) {
      return hits.map((hit) => this.toRetrievedMemory(hit));
    }

    let supabaseQuery = client
      .from("memories")
      .select(
        "id, content, category, type, source, source_detail, confidence, created_at, status, expires_at"
      )
      .in("id", candidateIds)
      .eq("status", "active");

    if (options.types?.length) {
      supabaseQuery = supabaseQuery.in("type", options.types);
    }

    const { data, error } = await supabaseQuery;
    if (error) throw new Error(`Retrieval failed: ${error.message}`);

    const active = new Map(
      ((data ?? []) as Array<{
        id: string;
        content: string;
        category: string | null;
        type: MemoryType;
        source: MemorySource;
        source_detail: string | null;
        confidence: number;
        created_at: string;
        expires_at: string | null;
      }>).filter((row) => !row.expires_at || new Date(row.expires_at) > new Date())
        .map((row) => [row.id, row])
    );

    const results: RetrievedMemory[] = [];
    for (const hit of hits) {
      const memoryId = hit.metadata?.cv_memory_id;
      const row = memoryId ? active.get(memoryId) : undefined;
      if (!row) continue;
      results.push({
        id: row.id,
        content: row.content,
        category: row.category,
        type: row.type,
        source: row.source,
        source_detail: row.source_detail,
        confidence: row.confidence,
        created_at: row.created_at,
        similarity: hit.score ?? 0,
      });
      if (results.length >= (options.limit ?? 8)) break;
    }

    return results;
  }

  async reembed(
    client: SupabaseClient,
    memoryId: string,
    content: string
  ): Promise<void> {
    const { data, error } = await client
      .from("memories")
      .select(
        "id, user_id, content, type, source, source_detail, category, confidence, status, is_sensitive, expires_at"
      )
      .eq("id", memoryId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load memory for re-embed: ${error.message}`);
    if (!data) throw new Error("Memory not found");

    const mem0Id = parseMem0Id(data.source_detail);
    if (!mem0Id) {
      throw new Error("No Mem0 id linked to this memory");
    }

    await this.client.updateMemory(mem0Id, {
      text: content,
      metadata: buildMem0Metadata(data.id, {
        content,
        type: data.type,
        source: data.source,
        source_detail: data.source_detail,
        category: data.category,
        confidence: data.confidence,
        status: data.status,
        is_sensitive: data.is_sensitive,
        expires_at: data.expires_at,
      }),
    });
  }

  private toRetrievedMemory(hit: {
    id: string;
    memory: string;
    score?: number;
    metadata?: {
      cv_memory_id?: string;
      type?: MemoryType;
      source?: MemorySource;
      category?: string | null;
      source_detail?: string | null;
      confidence?: number;
    };
    created_at?: string;
  }): RetrievedMemory {
    const metadata = hit.metadata ?? {};
    return {
      id: metadata.cv_memory_id ?? hit.id,
      content: hit.memory,
      category: metadata.category ?? null,
      type: metadata.type ?? "semantic",
      source: metadata.source ?? "manual",
      source_detail: metadata.source_detail ?? null,
      confidence: metadata.confidence ?? 1,
      created_at: hit.created_at ?? new Date().toISOString(),
      similarity: hit.score ?? 0,
    };
  }
}
