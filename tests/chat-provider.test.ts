import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockChatProvider } from "../src/lib/ai/mock";
import { OpenRouterChatProvider } from "../src/lib/ai/openrouter";
import { getChatProvider, readOpenRouterApiKey, resetChatProviderCache } from "../src/lib/ai";
import type { ChatMessage } from "../src/lib/ai/provider";

const withContext: ChatMessage[] = [
  { role: "system", content: "----- USER CONTEXT -----\nMemories:\n 1. I live in Lisbon\n----- END USER CONTEXT -----" },
  { role: "user", content: "where do I live?" },
];

const withoutContext: ChatMessage[] = [
  { role: "system", content: "(No saved user context was relevant to this message.)" },
  { role: "user", content: "hello" },
];

describe("MockChatProvider", () => {
  it("marks responses as mocked and echoes the user message", async () => {
    const res = await new MockChatProvider().complete("openai/gpt-4o-mini", withContext);
    expect(res.mocked).toBe(true);
    expect(res.model).toContain("(mock)");
    expect(res.content).toContain("where do I live?");
    expect(res.content).toContain("used your saved context");
  });

  it("reports when no context was injected", async () => {
    const res = await new MockChatProvider().complete("openai/gpt-4o-mini", withoutContext);
    expect(res.content).toContain("didn't find any relevant saved context");
  });
});

describe("OpenRouterChatProvider", () => {
  it("is a non-mock provider named 'openrouter'", () => {
    const provider = new OpenRouterChatProvider("test-key");
    expect(provider.name).toBe("openrouter");
  });
});

describe("readOpenRouterApiKey", () => {
  it("trims whitespace and surrounding quotes", () => {
    expect(readOpenRouterApiKey({ OPENROUTER_API_KEY: "  sk-test  " })).toBe("sk-test");
    expect(readOpenRouterApiKey({ OPENROUTER_API_KEY: '"sk-test"' })).toBe("sk-test");
    expect(readOpenRouterApiKey({ OPENROUTER_API_KEY: "'sk-test'" })).toBe("sk-test");
    expect(readOpenRouterApiKey({ OPENROUTER_API_KEY: "   " })).toBeNull();
    expect(readOpenRouterApiKey({})).toBeNull();
  });
});

describe("getChatProvider", () => {
  beforeEach(() => {
    resetChatProviderCache();
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    resetChatProviderCache();
  });

  it("falls back to the mock provider when OPENROUTER_API_KEY is not set", () => {
    delete process.env.OPENROUTER_API_KEY;
    resetChatProviderCache();
    expect(getChatProvider().name).toBe("mock");
  });

  it("selects OpenRouter when a key is present", () => {
    process.env.OPENROUTER_API_KEY = "sk-test-key";
    resetChatProviderCache();
    expect(getChatProvider().name).toBe("openrouter");
  });
});
