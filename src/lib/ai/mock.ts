import type {
  ChatCompletion,
  ChatCompletionOptions,
  ChatMessage,
  ChatProvider,
} from "./provider";

/**
 * Offline fallback chat provider. Used when no OPENROUTER_API_KEY is set so the
 * product stays fully demoable without network access. The reply deliberately
 * echoes whether USER CONTEXT was injected so memory retrieval is visibly
 * working end to end.
 */
export class MockChatProvider implements ChatProvider {
  readonly name = "mock";

  async complete(
    model: string,
    messages: ChatMessage[],
    _options?: ChatCompletionOptions
  ): Promise<ChatCompletion> {
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const hasContext =
      /USER CONTEXT[\s\S]*END USER CONTEXT/.test(system) &&
      !/No saved user context/.test(system);

    const parts: string[] = [
      "This is a local mock model (set OPENROUTER_API_KEY to use real models).",
    ];
    if (lastUser) parts.push(`\nYou said: "${lastUser.content.trim()}"`);
    parts.push(
      hasContext
        ? "\nI used your saved context for this answer — see the memories listed under this response."
        : "\nI didn't find any relevant saved context for this message."
    );

    return { content: parts.join("\n"), model: `${model} (mock)`, mocked: true };
  }
}
