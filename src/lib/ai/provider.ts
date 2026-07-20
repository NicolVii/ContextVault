export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletion {
  content: string;
  /** The resolved model label shown in the UI (may be suffixed, e.g. "(mock)"). */
  model: string;
  /** True when the local mock model produced the response. */
  mocked: boolean;
}

/** Optional knobs for a single completion (used by extraction and chat). */
export interface ChatCompletionOptions {
  temperature?: number;
  /** Request JSON-object mode when the upstream model supports it. */
  json?: boolean;
}

/**
 * Internal chat-provider interface. A concrete provider owns how a chat
 * completion is produced. The default `OpenRouterChatProvider` calls OpenRouter;
 * `MockChatProvider` keeps the app demoable offline. This mirrors the
 * MemoryProvider / EmbeddingProvider abstractions so backends stay swappable.
 */
export interface ChatProvider {
  readonly name: string;
  complete(
    model: string,
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletion>;
}
