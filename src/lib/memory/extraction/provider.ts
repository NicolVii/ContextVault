import type { MemoryType } from "@/lib/types";

/**
 * A raw candidate as produced by an extraction backend, before security
 * post-processing (secret blocking / sensitivity flagging).
 */
export interface RawExtractedCandidate {
  content: string;
  type: MemoryType;
  category: string | null;
  confidence: number;
}

/**
 * Final candidate destined for the review queue as `status: proposed`.
 * `is_sensitive` is always set by deterministic redaction, never trusted
 * from the model.
 */
export interface ExtractedCandidate extends RawExtractedCandidate {
  is_sensitive: boolean;
}

/**
 * Pluggable memory-extraction backend. Mirrors ChatProvider /
 * EmbeddingProvider / MemoryProvider so the chat route stays backend-agnostic.
 *
 * Concrete providers only propose candidates — they never write to the DB and
 * never mark memories active. Security filtering is applied by the orchestrator
 * in `extractCandidates`.
 */
export interface ExtractionProvider {
  readonly name: string;
  extract(text: string): Promise<RawExtractedCandidate[]>;
}
