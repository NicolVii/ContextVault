import { z } from "zod";
import { MEMORY_TYPES } from "@/lib/types";

/** Schema for a single memory object returned by the LLM extractor. */
export const extractedMemorySchema = z.object({
  content: z.string().trim().min(1).max(8000),
  type: z.enum(MEMORY_TYPES),
  category: z.string().trim().max(120).nullable().optional().default(null),
  confidence: z.number().min(0).max(1).optional().default(0.7),
});

export const extractionResponseSchema = z.object({
  memories: z.array(extractedMemorySchema).max(5),
});

export type ParsedExtraction = z.infer<typeof extractionResponseSchema>;

/**
 * Discriminated parse result so callers can tell apart:
 * - a valid intentional empty list (`{"memories":[]}`)
 * - malformed JSON / schema-invalid output (should trigger heuristic fallback)
 */
export type ParseExtractionResult =
  | { ok: true; memories: ParsedExtraction["memories"] }
  | { ok: false; error: string };

/**
 * Parse and validate LLM extraction JSON. Accepts either a bare object or a
 * fenced ```json ... ``` block.
 *
 * Returns `{ ok: true, memories }` for schema-valid payloads (including an
 * empty `memories` array). Returns `{ ok: false }` for empty, non-JSON, or
 * schema-invalid input — callers should treat that as an extraction failure.
 */
export function parseExtractionResponse(raw: string): ParseExtractionResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "empty response" };

  const candidates = [trimmed];
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.unshift(fence[1].trim());

  // Some models wrap JSON in prose — grab the outermost object if present.
  const brace = trimmed.match(/\{[\s\S]*\}/);
  if (brace?.[0] && brace[0] !== trimmed) candidates.push(brace[0]);

  let sawJson = false;
  for (const candidate of candidates) {
    try {
      const json: unknown = JSON.parse(candidate);
      sawJson = true;
      const parsed = extractionResponseSchema.safeParse(json);
      if (parsed.success) return { ok: true, memories: parsed.data.memories };
      // Tolerate a bare array of memories.
      const asArray = z.array(extractedMemorySchema).max(5).safeParse(json);
      if (asArray.success) return { ok: true, memories: asArray.data };
    } catch {
      // try next candidate
    }
  }

  return {
    ok: false,
    error: sawJson ? "schema validation failed" : "invalid JSON",
  };
}
