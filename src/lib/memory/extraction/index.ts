import { getChatProvider } from "@/lib/ai";
import { isSensitive, scanForForbiddenSecrets } from "../redaction";
import type { ExtractedCandidate, ExtractionProvider, RawExtractedCandidate } from "./provider";
import { HeuristicExtractionProvider } from "./heuristic";
import { LlmExtractionProvider } from "./llm";

export type { ExtractedCandidate, ExtractionProvider, RawExtractedCandidate } from "./provider";
export { HeuristicExtractionProvider } from "./heuristic";
export { LlmExtractionProvider } from "./llm";
export { parseExtractionResponse, extractionResponseSchema } from "./schema";

let cached: ExtractionProvider | null = null;
/** Test-only override; null means use the normal factory. */
let testOverride: ExtractionProvider | null = null;

/**
 * Resolve the active extraction provider.
 *
 * - When a real chat backend is available (OPENROUTER_API_KEY → non-mock
 *   ChatProvider), use structured LLM extraction.
 * - Otherwise fall back to deterministic heuristics so the app stays fully
 *   demoable offline.
 *
 * Mirrors getChatProvider() / getEmbeddingProvider() / getMemoryProvider().
 */
export function getExtractionProvider(): ExtractionProvider {
  if (testOverride) return testOverride;
  if (cached) return cached;
  const chat = getChatProvider();
  if (chat.name === "mock") {
    cached = new HeuristicExtractionProvider();
  } else {
    cached = new LlmExtractionProvider(chat);
  }
  return cached;
}

/** Test helper — clears the cached singleton between cases. */
export function resetExtractionProviderCache(): void {
  cached = null;
  testOverride = null;
}

/** Test helper — force a specific provider (e.g. a stubbed LLM). */
export function setExtractionProviderForTests(provider: ExtractionProvider): void {
  testOverride = provider;
  cached = null;
}

function finalize(raw: RawExtractedCandidate[]): ExtractedCandidate[] {
  const candidates: ExtractedCandidate[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const content = item.content.replace(/\s+/g, " ").trim();
    if (content.length < 3 || content.length > 8000) continue;

    // Deterministic security gate — never trust the model (or heuristics) alone.
    const { blocked } = scanForForbiddenSecrets(content);
    if (blocked) continue;

    const key = content.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      content,
      type: item.type,
      category: item.category,
      confidence: Math.min(1, Math.max(0, item.confidence)),
      is_sensitive: isSensitive(content),
    });

    if (candidates.length >= 5) break;
  }

  return candidates;
}

/**
 * Extract candidate memories from a user's chat message.
 *
 * Always returns items destined for the review queue as `proposed` — never
 * auto-active. Forbidden-secret patterns are dropped entirely; sensitive
 * content is flagged so it can never be auto-approved.
 *
 * Uses the active ExtractionProvider (LLM when available, heuristics offline).
 * If the LLM path throws, falls back to heuristics for that request so chat
 * is never blocked by extraction failures.
 */
export async function extractCandidates(text: string): Promise<ExtractedCandidate[]> {
  const provider = getExtractionProvider();
  let raw: RawExtractedCandidate[];
  try {
    raw = await provider.extract(text);
  } catch {
    // Per-request fallback — do not poison the cached provider.
    raw = await new HeuristicExtractionProvider().extract(text);
  }
  return finalize(raw);
}
