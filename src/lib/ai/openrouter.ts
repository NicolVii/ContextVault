import type {
  ChatCompletion,
  ChatCompletionOptions,
  ChatMessage,
  ChatProvider,
} from "./provider";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Chat provider backed by OpenRouter. The API key is server-only
 * (OPENROUTER_API_KEY) and is never sent to the browser. Model ids use
 * the provider's "vendor/model" form from registry bindings.
 */
export class OpenRouterChatProvider implements ChatProvider {
  readonly name = "openrouter";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly referer: string;
  private readonly title: string;

  constructor(apiKey: string, options: { baseUrl?: string; referer?: string; title?: string } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL;
    this.referer = options.referer ?? process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000";
    this.title = options.title ?? process.env.OPENROUTER_APP_TITLE ?? "Personal Memory";
  }

  async complete(
    model: string,
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletion> {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.3,
    };
    if (options.json) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": this.referer,
        "X-Title": this.title,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`);
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
      model,
      mocked: false,
      providerUsage: usage,
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
}
