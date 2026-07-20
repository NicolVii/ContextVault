import type { ChatCompletion, ChatMessage, ChatProvider } from "./provider";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Chat provider backed by OpenRouter. The API key is server-only
 * (OPENROUTER_API_KEY) and is never sent to the browser. Model ids use
 * OpenRouter's "vendor/model" form (see src/lib/ai/models.ts).
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
    this.title = options.title ?? "Context Vault";
  }

  async complete(model: string, messages: ChatMessage[]): Promise<ChatCompletion> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        // Optional attribution headers recommended by OpenRouter.
        "HTTP-Referer": this.referer,
        "X-Title": this.title,
      },
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return {
      content: json.choices?.[0]?.message?.content ?? "",
      model,
      mocked: false,
    };
  }
}
