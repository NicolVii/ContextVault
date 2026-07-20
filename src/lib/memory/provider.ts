import type { SupabaseClient } from "@supabase/supabase-js";
import type { Memory, MemoryType, MemorySource, RetrievedMemory } from "@/lib/types";

export interface NewMemory {
  content: string;
  type: MemoryType;
  category?: string | null;
  source: MemorySource;
  source_detail?: string | null;
  confidence?: number;
  is_sensitive?: boolean;
  /** 'active' for trusted manual entries, 'proposed' for anything extracted. */
  status?: "active" | "proposed";
  expires_at?: string | null;
}

export interface RetrieveOptions {
  limit?: number;
  types?: MemoryType[];
}

/**
 * Internal memory-service interface. A concrete provider owns how memories are
 * embedded, stored and retrieved. The default `SupabaseMemoryProvider` uses
 * pgvector; a dedicated provider such as Mem0 can be dropped in behind this
 * same interface without touching the rest of the app.
 *
 * All methods receive a request-scoped Supabase client so Row Level Security
 * continues to enforce per-user isolation for the Supabase implementation.
 */
export interface MemoryProvider {
  readonly name: string;
  /** Embed and persist memories for a user. Returns the inserted rows. */
  insert(
    client: SupabaseClient,
    userId: string,
    memories: NewMemory[]
  ): Promise<Memory[]>;
  /** Retrieve the most relevant active memories for a query. */
  retrieve(
    client: SupabaseClient,
    userId: string,
    query: string,
    options?: RetrieveOptions
  ): Promise<RetrievedMemory[]>;
  /** Re-embed a single memory after its content is edited. */
  reembed(client: SupabaseClient, memoryId: string, content: string): Promise<void>;
}
