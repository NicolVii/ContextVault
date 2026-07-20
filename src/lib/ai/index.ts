import type { ChatProvider } from "./provider";
import { OpenRouterChatProvider } from "./openrouter";
import { MockChatProvider } from "./mock";

let cached: ChatProvider | null = null;

/**
 * Resolve the active chat provider. OpenRouter is used whenever
 * OPENROUTER_API_KEY is configured; otherwise the offline mock provider keeps
 * the app working. Mirrors getMemoryProvider() / getEmbeddingProvider().
 */
export function getChatProvider(): ChatProvider {
  if (cached) return cached;
  const apiKey = process.env.OPENROUTER_API_KEY;
  cached = apiKey ? new OpenRouterChatProvider(apiKey) : new MockChatProvider();
  return cached;
}

export * from "./provider";
export { OpenRouterChatProvider } from "./openrouter";
export { MockChatProvider } from "./mock";
