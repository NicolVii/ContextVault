import type { SupabaseClient } from "@supabase/supabase-js";
import type { Memory, RetrievedMemory } from "@/lib/types";
import type { MemoryProvider, NewMemory, RetrieveOptions } from "./provider";

/**
 * Placeholder integration for a dedicated memory provider (Mem0).
 *
 * This demonstrates that the app is wired to swap memory backends behind the
 * `MemoryProvider` interface. To finish the integration, implement these
 * methods against the Mem0 REST API using MEM0_API_KEY and map Mem0's records
 * onto the app's Memory / RetrievedMemory shapes. Selected via
 * MEMORY_PROVIDER=mem0.
 */
export class Mem0MemoryProvider implements MemoryProvider {
  readonly name = "mem0";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async insert(
    _client: SupabaseClient,
    _userId: string,
    _memories: NewMemory[]
  ): Promise<Memory[]> {
    throw new Error(
      "Mem0MemoryProvider.insert is not implemented. Provide a Mem0 API client."
    );
  }

  async retrieve(
    _client: SupabaseClient,
    _userId: string,
    _query: string,
    _options?: RetrieveOptions
  ): Promise<RetrievedMemory[]> {
    throw new Error(
      "Mem0MemoryProvider.retrieve is not implemented. Provide a Mem0 API client."
    );
  }

  async reembed(): Promise<void> {
    // Mem0 manages its own embeddings; nothing to do.
  }
}
