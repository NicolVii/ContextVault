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
 * Parse and validate LLM extraction JSON. Accepts either a bare object or a
 * fenced ```json ... ``` block. Returns an empty list on unrecoverable input
 * so a bad model reply never crashes the chat turn.
 */
export function parseExtractionResponse(raw: string): ParsedExtraction {
  const trimmed = raw.trim();
  if (!trimmed) return { memories: [] };

  const candidates = [trimmed];
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.unshift(fence[1].trim());

  // Some models wrap JSON in prose — grab the outermost object if present.
  const brace = trimmed.match(/\{[\s\S]*\}/);
  if (brace?.[0] && brace[0] !== trimmed) candidates.push(brace[0]);

  for (const candidate of candidates) {
    try {
      const json: unknown = JSON.parse(candidate);
      const parsed = extractionResponseSchema.safeParse(json);
      if (parsed.success) return parsed.data;
      // Tolerate a bare array of memories.
      const asArray = z.array(extractedMemorySchema).max(5).safeParse(json);
      if (asArray.success) return { memories: asArray.data };
    } catch {
      // try next candidate
    }
  }

  return { memories: [] };
}
