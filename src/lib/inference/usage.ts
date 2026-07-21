import type { UsageDraft, UsageMeasures, MeasuresSource } from "./types";

/** OpenRouter (OpenAI-compatible) usage blob. */
export interface OpenRouterUsageBlob {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export function mapOpenRouterUsage(
  usage: OpenRouterUsageBlob | null | undefined,
  base: Omit<UsageDraft, "measures" | "measuresSource">
): UsageDraft {
  if (
    usage &&
    (typeof usage.prompt_tokens === "number" ||
      typeof usage.completion_tokens === "number" ||
      typeof usage.total_tokens === "number")
  ) {
    const measures: UsageMeasures = {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens:
        usage.total_tokens ??
        (typeof usage.prompt_tokens === "number" &&
        typeof usage.completion_tokens === "number"
          ? usage.prompt_tokens + usage.completion_tokens
          : undefined),
    };
    return { ...base, measures, measuresSource: "provider" };
  }

  return {
    ...base,
    measures: {},
    measuresSource: "estimated",
  };
}

/** Rough char→token estimate when a provider omits usage (e.g. mock / Ollama). */
export function estimateTokensFromMessages(
  messages: { content: string }[],
  outputContent: string
): { measures: UsageMeasures; measuresSource: MeasuresSource } {
  const inputChars = messages.reduce((n, m) => n + m.content.length, 0);
  const inputTokens = Math.max(1, Math.ceil(inputChars / 4));
  const outputTokens = Math.max(1, Math.ceil(outputContent.length / 4));
  return {
    measures: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    measuresSource: "estimated",
  };
}
