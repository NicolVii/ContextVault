import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  extractCandidates,
  getExtractionProvider,
  resetExtractionProviderCache,
  setExtractionProviderForTests,
  HeuristicExtractionProvider,
  LlmExtractionProvider,
  parseExtractionResponse,
} from "../src/lib/memory/extraction";
import { resetChatProviderCache } from "../src/lib/ai";
import type { ChatCompletion, ChatMessage, ChatProvider } from "../src/lib/ai/provider";

class StubChatProvider implements ChatProvider {
  readonly name = "stub";
  lastOptions: unknown;

  constructor(
    private readonly reply: string,
    private readonly shouldThrow = false
  ) {}

  async complete(
    _model: string,
    _messages: ChatMessage[],
    options?: unknown
  ): Promise<ChatCompletion> {
    this.lastOptions = options;
    if (this.shouldThrow) throw new Error("upstream failed");
    return { content: this.reply, model: "stub-model", mocked: false };
  }
}

describe("getExtractionProvider", () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    resetChatProviderCache();
    resetExtractionProviderCache();
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    resetChatProviderCache();
    resetExtractionProviderCache();
  });

  it("falls back to heuristics when no LLM chat backend is configured", () => {
    expect(getExtractionProvider().name).toBe("heuristic");
  });

  it("selects the LLM extractor when OpenRouter is configured", () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetChatProviderCache();
    resetExtractionProviderCache();
    expect(getExtractionProvider().name).toBe("llm");
  });
});

describe("parseExtractionResponse", () => {
  it("parses a clean JSON object", () => {
    const parsed = parseExtractionResponse(
      JSON.stringify({
        memories: [
          {
            content: "I prefer concise answers.",
            type: "preference",
            category: "Preferences",
            confidence: 0.9,
          },
        ],
      })
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.memories).toHaveLength(1);
    expect(parsed.memories[0].type).toBe("preference");
  });

  it("parses fenced JSON and bare arrays", () => {
    const fenced = parseExtractionResponse(
      'Here you go:\n```json\n{"memories":[{"content":"I live in Lisbon","type":"profile","confidence":0.8}]}\n```'
    );
    expect(fenced.ok).toBe(true);
    if (!fenced.ok) return;
    expect(fenced.memories[0].content).toBe("I live in Lisbon");

    const bare = parseExtractionResponse(
      JSON.stringify([{ content: "I use TypeScript", type: "preference", confidence: 0.6 }])
    );
    expect(bare.ok).toBe(true);
    if (!bare.ok) return;
    expect(bare.memories[0].type).toBe("preference");
  });

  it("treats a valid empty memories list as success", () => {
    const parsed = parseExtractionResponse(JSON.stringify({ memories: [] }));
    expect(parsed).toEqual({ ok: true, memories: [] });
  });

  it("returns ok:false for invalid JSON or empty input", () => {
    expect(parseExtractionResponse("not json").ok).toBe(false);
    expect(parseExtractionResponse("").ok).toBe(false);
  });

  it("returns ok:false for unknown memory types", () => {
    const parsed = parseExtractionResponse(
      JSON.stringify({
        memories: [{ content: "I like cats", type: "not-a-type", confidence: 0.5 }],
      })
    );
    expect(parsed.ok).toBe(false);
  });
});

describe("LlmExtractionProvider", () => {
  it("maps structured LLM output into raw candidates and requests JSON mode", async () => {
    const stub = new StubChatProvider(
      JSON.stringify({
        memories: [
          {
            content: "I prefer dark mode.",
            type: "preference",
            category: "Preferences",
            confidence: 0.85,
          },
        ],
      })
    );
    const provider = new LlmExtractionProvider(stub);
    const raw = await provider.extract("I really like dark mode in all my apps.");
    expect(provider.name).toBe("llm");
    expect(raw).toHaveLength(1);
    expect(raw[0].content).toBe("I prefer dark mode.");
    expect(raw[0].type).toBe("preference");
    expect(stub.lastOptions).toMatchObject({ temperature: 0, json: true });
  });
});

describe("extractCandidates with LLM provider", () => {
  beforeEach(() => {
    resetExtractionProviderCache();
  });

  it("drops secret-bearing candidates even if the model returns them", async () => {
    setExtractionProviderForTests(
      new LlmExtractionProvider(
        new StubChatProvider(
          JSON.stringify({
            memories: [
              { content: "My password is hunter2", type: "semantic", confidence: 0.9 },
              {
                content: "I live in Lisbon",
                type: "profile",
                category: "About me",
                confidence: 0.9,
              },
            ],
          })
        )
      )
    );

    const candidates = await extractCandidates("ignored — stub returns fixed JSON");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].content).toBe("I live in Lisbon");
    expect(candidates[0].type).toBe("profile");
  });

  it("flags sensitive content from LLM output using deterministic rules", async () => {
    setExtractionProviderForTests(
      new LlmExtractionProvider(
        new StubChatProvider(
          JSON.stringify({
            memories: [
              {
                content: "I was diagnosed with asthma",
                type: "profile",
                category: "Health",
                confidence: 0.8,
              },
            ],
          })
        )
      )
    );

    const candidates = await extractCandidates("ignored");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].is_sensitive).toBe(true);
  });

  it("falls back to heuristics when the LLM provider throws", async () => {
    setExtractionProviderForTests(
      new LlmExtractionProvider(new StubChatProvider("", true))
    );

    const candidates = await extractCandidates("I prefer tea over coffee.");
    expect(candidates.some((c) => c.type === "preference")).toBe(true);
  });

  it("preserves an intentionally empty valid LLM result without heuristic fallback", async () => {
    setExtractionProviderForTests(
      new LlmExtractionProvider(
        new StubChatProvider(JSON.stringify({ memories: [] }))
      )
    );

    // Heuristics would extract a preference from this text; a valid empty
    // LLM response must win and stay empty.
    const candidates = await extractCandidates("I prefer tea over coffee.");
    expect(candidates).toEqual([]);
  });

  it("falls back to heuristics when LLM output is invalid JSON", async () => {
    setExtractionProviderForTests(
      new LlmExtractionProvider(new StubChatProvider("this is not json at all"))
    );

    const candidates = await extractCandidates("I prefer tea over coffee.");
    expect(candidates.some((c) => c.type === "preference")).toBe(true);
  });

  it("falls back to heuristics when LLM output fails schema validation", async () => {
    setExtractionProviderForTests(
      new LlmExtractionProvider(
        new StubChatProvider(
          JSON.stringify({
            memories: [{ content: "I like cats", type: "not-a-type", confidence: 0.5 }],
          })
        )
      )
    );

    const candidates = await extractCandidates("I prefer tea over coffee.");
    expect(candidates.some((c) => c.type === "preference")).toBe(true);
  });
});

describe("HeuristicExtractionProvider", () => {
  it("extracts first-person preference statements", async () => {
    const raw = await new HeuristicExtractionProvider().extract(
      "I prefer tea over coffee."
    );
    expect(raw.some((c) => c.type === "preference")).toBe(true);
  });
});
