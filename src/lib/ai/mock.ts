import type {
  ChatCompletion,
  ChatCompletionOptions,
  ChatMessage,
  ChatProvider,
} from "./provider";

/**
 * Offline fallback chat provider. Used when no OPENROUTER_API_KEY is set so the
 * product stays fully demoable without network access. The reply deliberately
 * echoes whether USER CONTEXT / USER IDENTITY was injected so retrieval is
 * visibly working end to end. When a name is present and the user asks for it,
 * answer directly so offline demos match the identity-injection path.
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
    const combined = `${system}\n${lastUser?.content ?? ""}`;
    const hasContext =
      (/USER CONTEXT[\s\S]*END USER CONTEXT/.test(system) ||
        /USER IDENTITY[\s\S]*END USER IDENTITY/.test(system) ||
        /Account profile for this reply/.test(lastUser?.content ?? "")) &&
      !/No saved user context/.test(system);

    const nameMatch = combined.match(/The user's name is ([^\n.]+)\./);
    const askedName = /\b(what(?:'s| is|s)? my name|who am i|do you know my name)\b/i.test(
      lastUser?.content ?? ""
    );

    if (askedName && nameMatch?.[1]) {
      return {
        content: `Your name is ${nameMatch[1].trim()}.`,
        model: `${model} (mock)`,
        mocked: true,
      };
    }

    const parts: string[] = [
      "This is a local mock model (set OPENROUTER_API_KEY to use real models).",
    ];
    if (lastUser) {
      const visible = lastUser.content.replace(
        /^\[Account profile for this reply[\s\S]*?\n\n/,
        ""
      );
      parts.push(`\nYou said: "${visible.trim()}"`);
    }
    parts.push(
      hasContext
        ? "\nI used your saved context for this answer — see the memories listed under this response."
        : "\nI didn't find any relevant saved context for this message."
    );

    return { content: parts.join("\n"), model: `${model} (mock)`, mocked: true };
  }
}
