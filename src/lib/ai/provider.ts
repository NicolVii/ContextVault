import type { MeasuresSource, UsageMeasures } from "@/lib/inference/types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletion {
  content: string;
  /** Display / resolved model label (may be suffixed, e.g. "(mock)"). */
  model: string;
  mocked: boolean;
  /** Canonical usage measures when the adapter could produce them. */
  usage?: {
    measures: UsageMeasures;
    measuresSource: MeasuresSource;
  };
  /** Raw OpenAI-compatible usage blob for mappers (OpenRouter). */
  providerUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/** Optional knobs for a single completion (used by extraction and chat). */
export interface ChatCompletionOptions {
  temperature?: number;
  /** Request JSON-object mode when the upstream model supports it. */
  json?: boolean;
}

/**
 * Outbound LLM adapter port. Adapters speak provider model ids.
 * Product code should prefer the Inference Router (`runInference`) instead.
 */
export interface ChatProvider {
  readonly name: string;
  complete(
    model: string,
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletion>;
}
