export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  model: string;
  mocked: boolean;
}

/**
 * Call an OpenRouter chat model. The API key is read from the server-only
 * OPENROUTER_API_KEY and is never sent to the browser.
 *
 * When no key is configured the app falls back to a local mock model so the
 * whole product remains demoable offline. The mock deliberately echoes the
 * injected USER CONTEXT so memory retrieval is visibly working.
 */
export async function chatComplete(
  model: string,
  messages: ChatMessage[]
): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { content: mockResponse(messages), model: `${model} (mock)`, mocked: true };
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Context Vault",
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return {
    content: json.choices?.[0]?.message?.content ?? "",
    model,
    mocked: false,
  };
}

function mockResponse(messages: ChatMessage[]): string {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const contextMatch = system.match(/USER CONTEXT[\s\S]*END USER CONTEXT/);
  const hasContext = contextMatch && !/No saved user context/.test(system);

  const parts: string[] = [];
  parts.push(
    "This is a local mock model (set OPENROUTER_API_KEY to use real models)."
  );
  if (lastUser) parts.push(`\nYou said: "${lastUser.content.trim()}"`);
  if (hasContext) {
    parts.push(
      "\nI used your saved context for this answer — see the memories listed under this response."
    );
  } else {
    parts.push("\nI didn't find any relevant saved context for this message.");
  }
  return parts.join("\n");
}
