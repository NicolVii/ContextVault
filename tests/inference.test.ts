import { describe, it, expect } from "vitest";
import {
  DEFAULT_MODEL_ID,
  parseSelection,
  resolveModelProfile,
  isValidSelection,
  toProviderModelId,
  selectionToStorageKey,
} from "../src/lib/inference/models";
import { resolveRoute } from "../src/lib/inference/router";
import { estimateCredits, getPriceBookEntry } from "../src/lib/inference/pricing";
import { mapOpenRouterUsage, estimateTokensFromMessages } from "../src/lib/inference/usage";

describe("model registry", () => {
  it("resolves cortaix ids and legacy OpenRouter ids", () => {
    expect(resolveModelProfile("openai.gpt-4o-mini")?.id).toBe("openai.gpt-4o-mini");
    expect(resolveModelProfile("openai/gpt-4o-mini")?.id).toBe("openai.gpt-4o-mini");
    expect(resolveModelProfile("meta-llama/llama-3.1-70b-instruct")?.id).toBe(
      "meta.llama-3.1-70b-instruct"
    );
  });

  it("maps to provider binding ids", () => {
    expect(toProviderModelId("openai.gpt-4o-mini")).toBe("openai/gpt-4o-mini");
    expect(toProviderModelId("anthropic.claude-3.5-sonnet")).toBe(
      "anthropic/claude-3.5-sonnet"
    );
  });

  it("parses selection policies", () => {
    expect(parseSelection("auto")).toEqual({ type: "auto" });
    expect(parseSelection("preset:coding")).toEqual({
      type: "preset",
      preset: "coding",
    });
    expect(parseSelection("openai.gpt-4o")).toEqual({
      type: "model",
      modelId: "openai.gpt-4o",
    });
    expect(selectionToStorageKey({ type: "preset", preset: "fast" })).toBe(
      "preset:fast"
    );
  });

  it("validates selections", () => {
    expect(isValidSelection("auto")).toBe(true);
    expect(isValidSelection("preset:cheap")).toBe(true);
    expect(isValidSelection(DEFAULT_MODEL_ID)).toBe(true);
    expect(isValidSelection("openai/gpt-4o")).toBe(true);
    expect(isValidSelection("preset:nope")).toBe(false);
    expect(isValidSelection("totally.unknown")).toBe(false);
  });
});

describe("deterministic router", () => {
  it("honors explicit model selection", () => {
    const decision = resolveRoute(
      { type: "model", modelId: "anthropic.claude-3.5-sonnet" },
      { purpose: "chat", input: { messages: [] } }
    );
    expect(decision.modelId).toBe("anthropic.claude-3.5-sonnet");
    expect(decision.reasonCode).toBe("explicit_model");
    expect(decision.providerModelId).toBe("anthropic/claude-3.5-sonnet");
  });

  it("picks coding preset → Claude", () => {
    const decision = resolveRoute(
      { type: "preset", preset: "coding" },
      { purpose: "chat", input: { messages: [] } }
    );
    expect(decision.modelId).toBe("anthropic.claude-3.5-sonnet");
    expect(decision.reasonCode).toBe("preset_coding");
  });

  it("auto-routes vision attachments", () => {
    const decision = resolveRoute(
      { type: "auto" },
      {
        purpose: "chat",
        input: {
          messages: [{ role: "user", content: "what is in this image?" }],
          hasVisionAttachment: true,
        },
      }
    );
    expect(decision.profile.capabilities.vision).toBe(true);
    expect(decision.reasonCode).toBe("vision_required");
  });

  it("auto-routes long context", () => {
    const decision = resolveRoute(
      { type: "auto" },
      {
        purpose: "chat",
        input: {
          messages: [{ role: "user", content: "summarize" }],
          contextChars: 50_000,
        },
      }
    );
    expect(decision.reasonCode).toBe("long_context_required");
    expect(decision.modelId).toBe("google.gemini-flash-1.5");
  });

  it("auto-routes coding heuristics among Auto-eligible models", () => {
    const decision = resolveRoute(
      { type: "auto" },
      {
        purpose: "chat",
        input: {
          messages: [
            { role: "user", content: "Help me debug this TypeScript function" },
          ],
        },
      }
    );
    expect(decision.reasonCode).toBe("coding_heuristic");
    // Frontier models (e.g. Claude) are excluded from Auto unless auto-eligible.
    expect(decision.modelId).toBe("meta.llama-3.1-70b-instruct");
  });

  it("defaults cheap/fast for simple chat", () => {
    const decision = resolveRoute(
      { type: "auto" },
      {
        purpose: "chat",
        input: { messages: [{ role: "user", content: "hello there" }] },
      }
    );
    expect(decision.reasonCode).toBe("cost_optimized");
  });
});

describe("pricing and usage", () => {
  it("estimates credits with a minimum floor", () => {
    const entry = getPriceBookEntry("openai.gpt-4o-mini");
    expect(estimateCredits("openai.gpt-4o-mini", 1, 1)).toBe(entry.minCredits);
    expect(estimateCredits("openai.gpt-4o-mini", 10_000, 10_000)).toBeGreaterThan(
      entry.minCredits
    );
  });

  it("maps OpenRouter usage into canonical measures", () => {
    const draft = mapOpenRouterUsage(
      { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      {
        requestId: "r1",
        tenantId: "t1",
        userId: "u1",
        purpose: "chat",
        modelId: "openai.gpt-4o-mini",
        provider: "openrouter",
        providerModelId: "openai/gpt-4o-mini",
        billingMode: "platform",
      }
    );
    expect(draft.measuresSource).toBe("provider");
    expect(draft.measures.inputTokens).toBe(10);
    expect(draft.measures.outputTokens).toBe(5);
  });

  it("estimates tokens when usage is missing", () => {
    const est = estimateTokensFromMessages(
      [{ content: "abcd" }],
      "abcdefgh"
    );
    expect(est.measuresSource).toBe("estimated");
    expect(est.measures.inputTokens).toBe(1);
    expect(est.measures.outputTokens).toBe(2);
  });
});
