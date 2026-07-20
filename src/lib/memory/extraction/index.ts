import { getChatProvider } from "@/lib/ai";
import { isSensitive, scanForForbiddenSecrets } from "../redaction";
import type { ExtractedCandidate, ExtractionProvider, RawExtractedCandidate } from "./provider";
import { HeuristicExtractionProvider } from "./heuristic";
import { LlmExtractionProvider } from "./llm";
import { shouldSkipExtraction } from "./skip";

export type { ExtractedCandidate, ExtractionProvider, RawExtractedCandidate } from "./provider";
export { HeuristicExtractionProvider } from "./heuristic";
export { LlmExtractionProvider } from "./llm";
export { parseExtractionResponse, extractionResponseSchema } from "./schema";
export type { ParseExtractionResult } from "./schema";
export { shouldSkipExtraction, hasFirstPersonReference } from "./skip";
export { EXTRACTION_SYSTEM_PROMPT } from "./llm";

/** Default budget for a single extraction call (ms). Overridable via env. */
export const DEFAULT_EXTRACTION_TIMEOUT_MS = 8_000;

let cached: ExtractionProvider | null = null;
/** Test-only override; null means use the normal factory. */
let testOverride: ExtractionProvider | null = null;
/** Test-only timeout override in ms; null means use env / default. */
let testTimeoutMs: number | null = null;

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
  testTimeoutMs = null;
}

/** Test helper — force a specific provider (e.g. a stubbed LLM). */
export function setExtractionProviderForTests(provider: ExtractionProvider): void {
  testOverride = provider;
  cached = null;
}

/** Test helper — override the extraction timeout (ms). */
export function setExtractionTimeoutForTests(ms: number | null): void {
  testTimeoutMs = ms;
}

export function getExtractionTimeoutMs(): number {
  if (testTimeoutMs != null) return testTimeoutMs;
  const raw = process.env.EXTRACTION_TIMEOUT_MS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_EXTRACTION_TIMEOUT_MS;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Extraction timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        if (timer) clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        if (timer) clearTimeout(timer);
        reject(err);
      }
    );
  });
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
 * Obvious greetings / acknowledgements / impersonal questions are skipped
 * without calling the model. If the LLM path throws or times out (network
 * error, invalid JSON, schema-invalid output), falls back to heuristics for
 * that request so chat is never blocked. A valid `{"memories":[]}` is kept as
 * intentionally empty and does not trigger the fallback.
 */
export async function extractCandidates(text: string): Promise<ExtractedCandidate[]> {
  if (shouldSkipExtraction(text)) return [];

  const provider = getExtractionProvider();
  const timeoutMs = getExtractionTimeoutMs();
  let raw: RawExtractedCandidate[];
  try {
    raw = await withTimeout(provider.extract(text), timeoutMs);
  } catch {
    // Per-request fallback — do not poison the cached provider.
    raw = await new HeuristicExtractionProvider().extract(text);
  }
  return finalize(raw);
}
