import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  extractCandidates,
  getExtractionProvider,
  resetExtractionProviderCache,
  setExtractionProviderForTests,
  setExtractionTimeoutForTests,
  HeuristicExtractionProvider,
  LlmExtractionProvider,
  parseExtractionResponse,
  shouldSkipExtraction,
  EXTRACTION_SYSTEM_PROMPT,
} from "../src/lib/memory/extraction";
import { resetChatProviderCache } from "../src/lib/ai";
import type { ChatCompletion, ChatMessage, ChatProvider } from "../src/lib/ai/provider";

class StubChatProvider implements ChatProvider {
  readonly name = "stub";
  lastOptions: unknown;
  callCount = 0;

  constructor(
    private readonly reply: string | ((messages: ChatMessage[]) => string),
    private readonly shouldThrow = false
  ) {}

  async complete(
    _model: string,
    messages: ChatMessage[],
    options?: unknown
  ): Promise<ChatCompletion> {
    this.callCount += 1;
    this.lastOptions = options;
    if (this.shouldThrow) throw new Error("upstream failed");
    const content =
      typeof this.reply === "function" ? this.reply(messages) : this.reply;
    return { content, model: "stub-model", mocked: false };
  }
}

class SlowStubChatProvider implements ChatProvider {
  readonly name = "stub";
  callCount = 0;

  constructor(
    private readonly delayMs: number,
    private readonly reply = JSON.stringify({ memories: [] })
  ) {}

  async complete(): Promise<ChatCompletion> {
    this.callCount += 1;
    await new Promise((r) => setTimeout(r, this.delayMs));
    return { content: this.reply, model: "stub-model", mocked: false };
  }
}

/** Well-behaved stub: returns fixed memories JSON (simulates a correct model). */
function llmReturning(memories: unknown[]) {
  return new LlmExtractionProvider(
    new StubChatProvider(JSON.stringify({ memories }))
  );
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

describe("shouldSkipExtraction (trivial / impersonal pre-check)", () => {
  it("skips greetings and acknowledgements", () => {
    expect(shouldSkipExtraction("Hi")).toBe(true);
    expect(shouldSkipExtraction("hello!")).toBe(true);
    expect(shouldSkipExtraction("Good morning")).toBe(true);
    expect(shouldSkipExtraction("Thanks")).toBe(true);
    expect(shouldSkipExtraction("ok")).toBe(true);
    expect(shouldSkipExtraction("got it")).toBe(true);
  });

  it("skips impersonal factual questions", () => {
    expect(shouldSkipExtraction("What is the capital of France?")).toBe(true);
    expect(shouldSkipExtraction("How does photosynthesis work?")).toBe(true);
    expect(shouldSkipExtraction("Who invented the telephone?")).toBe(true);
  });

  it("does not skip personal content or standing preferences", () => {
    expect(shouldSkipExtraction("I prefer dark mode")).toBe(false);
    expect(shouldSkipExtraction("What is my name?")).toBe(false);
    expect(shouldSkipExtraction("Always be concise with me")).toBe(false);
    expect(shouldSkipExtraction("Thanks! I live in Lisbon.")).toBe(false);
  });
});

describe("extraction prompt contract", () => {
  it("asks for persistent preferences and standing instructions, not one-off commands", () => {
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/persistent communication preferences/i);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/standing instructions/i);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/one-time task commands/i);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/hypotheticals/i);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/third-party/i);
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

describe("extractCandidates behavioural cases", () => {
  beforeEach(() => {
    resetExtractionProviderCache();
  });

  afterEach(() => {
    resetExtractionProviderCache();
  });

  it("extracts an implicit durable preference from a well-behaved LLM", async () => {
    setExtractionProviderForTests(
      llmReturning([
        {
          content: "I am a night owl and do my best work late at night.",
          type: "preference",
          category: "Preferences",
          confidence: 0.75,
        },
      ])
    );
    const candidates = await extractCandidates(
      "I'm usually useless before noon — nights are when I get real work done."
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].type).toBe("preference");
    expect(candidates[0].content.toLowerCase()).toMatch(/night/);
  });

  it("keeps questions empty when the LLM correctly returns no memories", async () => {
    const stub = new StubChatProvider(JSON.stringify({ memories: [] }));
    setExtractionProviderForTests(new LlmExtractionProvider(stub));
    // Personal question — not skipped by pre-check — but nothing durable to store.
    const candidates = await extractCandidates("What should I cook for dinner tonight?");
    expect(stub.callCount).toBe(1);
    expect(candidates).toEqual([]);
  });

  it("keeps third-party facts empty when the LLM correctly returns no memories", async () => {
    setExtractionProviderForTests(llmReturning([]));
    const candidates = await extractCandidates(
      "Sarah lives in Berlin and works as a designer."
    );
    expect(candidates).toEqual([]);
  });

  it("keeps hypotheticals empty when the LLM correctly returns no memories", async () => {
    setExtractionProviderForTests(llmReturning([]));
    const candidates = await extractCandidates(
      "If I lived in Tokyo I would probably learn Japanese."
    );
    expect(candidates).toEqual([]);
  });

  it("extracts persistent communication instructions from a well-behaved LLM", async () => {
    setExtractionProviderForTests(
      llmReturning([
        {
          content: "I prefer concise answers in bullet points.",
          type: "preference",
          category: "Preferences",
          confidence: 0.9,
        },
      ])
    );
    const candidates = await extractCandidates(
      "From now on always be concise and use bullet points with me."
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].type).toBe("preference");
    expect(candidates[0].content.toLowerCase()).toMatch(/concise|bullet/);
  });

  it("does not treat one-time commands as memories when the LLM returns empty", async () => {
    setExtractionProviderForTests(llmReturning([]));
    const candidates = await extractCandidates(
      "Please summarize the paragraph below in two sentences."
    );
    expect(candidates).toEqual([]);
  });

  it("skips trivial greetings without calling the LLM", async () => {
    const stub = new StubChatProvider(JSON.stringify({ memories: [] }));
    setExtractionProviderForTests(new LlmExtractionProvider(stub));
    const candidates = await extractCandidates("Hello!");
    expect(stub.callCount).toBe(0);
    expect(candidates).toEqual([]);
  });

  it("skips impersonal factual questions without calling the LLM", async () => {
    const stub = new StubChatProvider(JSON.stringify({ memories: [] }));
    setExtractionProviderForTests(new LlmExtractionProvider(stub));
    const candidates = await extractCandidates("What is the capital of France?");
    expect(stub.callCount).toBe(0);
    expect(candidates).toEqual([]);
  });

  it("drops secret-bearing candidates even if the model returns them", async () => {
    setExtractionProviderForTests(
      llmReturning([
        { content: "My password is hunter2", type: "semantic", confidence: 0.9 },
        {
          content: "I live in Lisbon",
          type: "profile",
          category: "About me",
          confidence: 0.9,
        },
      ])
    );

    const candidates = await extractCandidates("ignored — stub returns fixed JSON");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].content).toBe("I live in Lisbon");
    expect(candidates[0].type).toBe("profile");
  });

  it("flags sensitive content from LLM output using deterministic rules", async () => {
    setExtractionProviderForTests(
      llmReturning([
        {
          content: "I was diagnosed with asthma",
          type: "profile",
          category: "Health",
          confidence: 0.8,
        },
      ])
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
    setExtractionProviderForTests(llmReturning([]));

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

  it("falls back to heuristics when extraction times out", async () => {
    setExtractionTimeoutForTests(40);
    setExtractionProviderForTests(
      new LlmExtractionProvider(new SlowStubChatProvider(500))
    );

    const started = Date.now();
    const candidates = await extractCandidates("I prefer tea over coffee.");
    const elapsed = Date.now() - started;

    expect(candidates.some((c) => c.type === "preference")).toBe(true);
    // Should not wait for the full slow stub delay.
    expect(elapsed).toBeLessThan(400);
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
