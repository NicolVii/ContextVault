import type { ChatMessage } from "@/lib/ai/provider";
import type { MeasuresSource, UsageMeasures } from "../types";

export interface AdapterCompletion {
  content: string;
  mocked: boolean;
  usage?: {
    measures: UsageMeasures;
    measuresSource: MeasuresSource;
  };
}

export interface ProviderAdapter {
  readonly name: string;
  complete(input: {
    model: string;
    messages: ChatMessage[];
    apiKey: string;
    temperature?: number;
    json?: boolean;
  }): Promise<AdapterCompletion>;
}

/** Shared OpenAI-compatible chat completions (OpenAI, Groq, Google OpenAI compat, OpenRouter). */
export async function openAiCompatibleComplete(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  json?: boolean;
  extraHeaders?: Record<string, string>;
}): Promise<AdapterCompletion> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature ?? 0.3,
  };
  if (input.json) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${input.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
      ...input.extraHeaders,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`${input.baseUrl} request failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const usage = json.usage;
  return {
    content: json.choices?.[0]?.message?.content ?? "",
    mocked: false,
    usage: usage
      ? {
          measures: {
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          },
          measuresSource: "provider",
        }
      : undefined,
  };
}
