import { openAiCompatibleComplete, type ProviderAdapter } from "./types";

export const openRouterAdapter: ProviderAdapter = {
  name: "openrouter",
  async complete({ model, messages, apiKey, temperature, json }) {
    return openAiCompatibleComplete({
      baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      apiKey,
      model,
      messages,
      temperature,
      json,
      extraHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
        "X-Title": "Cortaix",
      },
    });
  },
};

export const openAiAdapter: ProviderAdapter = {
  name: "openai",
  async complete({ model, messages, apiKey, temperature, json }) {
    return openAiCompatibleComplete({
      baseUrl: "https://api.openai.com/v1",
      apiKey,
      model,
      messages,
      temperature,
      json,
    });
  },
};

export const groqAdapter: ProviderAdapter = {
  name: "groq",
  async complete({ model, messages, apiKey, temperature, json }) {
    return openAiCompatibleComplete({
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey,
      model,
      messages,
      temperature,
      json,
    });
  },
};

export const googleAdapter: ProviderAdapter = {
  name: "google",
  async complete({ model, messages, apiKey, temperature, json }) {
    return openAiCompatibleComplete({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey,
      model,
      messages,
      temperature,
      json,
    });
  },
};

export const anthropicAdapter: ProviderAdapter = {
  name: "anthropic",
  async complete({ model, messages, apiKey, temperature, json }) {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const anthropicMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      temperature: temperature ?? 0.3,
      messages: anthropicMessages,
    };
    if (system) body.system = system;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Anthropic request failed: ${res.status} ${await res.text()}`);
    }

    const jsonBody = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text =
      jsonBody.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ??
      "";

    // json mode is best-effort — Anthropic doesn't share OpenAI response_format.
    void json;

    return {
      content: text,
      mocked: false,
      usage: jsonBody.usage
        ? {
            measures: {
              inputTokens: jsonBody.usage.input_tokens,
              outputTokens: jsonBody.usage.output_tokens,
              totalTokens:
                (jsonBody.usage.input_tokens ?? 0) + (jsonBody.usage.output_tokens ?? 0),
            },
            measuresSource: "provider" as const,
          }
        : undefined,
    };
  },
};

export const mockAdapter: ProviderAdapter = {
  name: "mock",
  async complete({ model, messages }) {
    const { MockChatProvider } = await import("@/lib/ai/mock");
    const result = await new MockChatProvider().complete(model, messages);
    return {
      content: result.content,
      mocked: true,
      usage: result.usage,
    };
  },
};

const ADAPTERS: Record<string, ProviderAdapter> = {
  openrouter: openRouterAdapter,
  openai: openAiAdapter,
  anthropic: anthropicAdapter,
  google: googleAdapter,
  groq: groqAdapter,
  mock: mockAdapter,
};

export function getAdapter(provider: string): ProviderAdapter | null {
  return ADAPTERS[provider] ?? null;
}

export function listAdapters(): string[] {
  return Object.keys(ADAPTERS);
}
