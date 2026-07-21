import type { ChatProvider } from "./provider";
import { OpenRouterChatProvider } from "./openrouter";
import { MockChatProvider } from "./mock";

let cached: ChatProvider | null = null;

/**
 * Read OPENROUTER_API_KEY, trimming whitespace and optional surrounding quotes
 * that are easy to paste accidentally in Vercel/hosting dashboards.
 */
export function readOpenRouterApiKey(
  env: Record<string, string | undefined> = process.env
): string | null {
  const raw = env.OPENROUTER_API_KEY;
  if (raw == null) return null;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key.length > 0 ? key : null;
}

/**
 * Resolve the active chat provider. OpenRouter is used whenever
 * OPENROUTER_API_KEY is configured; otherwise the offline mock provider keeps
 * the app working. Mirrors getMemoryProvider() / getEmbeddingProvider().
 */
export function getChatProvider(): ChatProvider {
  if (cached) return cached;
  const apiKey = readOpenRouterApiKey();
  cached = apiKey ? new OpenRouterChatProvider(apiKey) : new MockChatProvider();
  return cached;
}

/** Test helper — clears the cached singleton between cases. */
export function resetChatProviderCache(): void {
  cached = null;
}

export * from "./provider";
export { OpenRouterChatProvider } from "./openrouter";
export { MockChatProvider } from "./mock";
