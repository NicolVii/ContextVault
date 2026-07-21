import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedChunk } from "@/lib/types";
import { getEmbeddingProvider } from "@/lib/embeddings";

export interface DocumentRetrieveOptions {
  limit?: number;
  minSimilarity?: number;
}

/**
 * Document chunk retrieval port. Hides embeddings + RPC from the orchestrator.
 */
export interface DocumentRetriever {
  retrieve(
    userId: string,
    query: string,
    options?: DocumentRetrieveOptions
  ): Promise<RetrievedChunk[]>;
}

export function createSupabaseDocumentRetriever(
  client: SupabaseClient
): DocumentRetriever {
  return {
    async retrieve(_userId, query, options = {}) {
      const limit = options.limit ?? 3;
      const minSimilarity = options.minSimilarity ?? 0.05;
      const [embedding] = await getEmbeddingProvider().embed([query]);
      const { data: chunkData } = await client.rpc("match_document_chunks", {
        query_embedding: `[${embedding.join(",")}]`,
        match_count: limit,
      });
      return ((chunkData ?? []) as RetrievedChunk[]).filter(
        (c) => c.similarity >= minSimilarity
      );
    },
  };
}
