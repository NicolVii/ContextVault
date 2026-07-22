import { describe, it, expect, beforeEach } from "vitest";
import { resolveRoute } from "../src/lib/inference/router";
import {
  filterAndOrderBindings,
  getDefaultProviderOpsSnapshot,
  invalidateProviderOpsCache,
  isProviderConfigured,
  setProviderOpsSnapshotCache,
  type ProviderOpsSnapshot,
} from "../src/lib/inference/provider-ops";

function snapshotWith(
  mutate: (s: ProviderOpsSnapshot) => void
): ProviderOpsSnapshot {
  const s = getDefaultProviderOpsSnapshot();
  mutate(s);
  return s;
}

describe("provider ops routing filters", () => {
  beforeEach(() => {
    invalidateProviderOpsCache();
  });

  it("skips disabled providers when ordering bindings", () => {
    const snap = snapshotWith((s) => {
      const openrouter = s.providers.get("openrouter")!;
      s.providers.set("openrouter", { ...openrouter, enabled: false });
      const openai = s.providers.get("openai")!;
      s.providers.set("openai", { ...openai, fallbackPriority: 5 });
    });

    const ordered = filterAndOrderBindings(
      [
        { provider: "openrouter", providerModelId: "openai/gpt-4o-mini" },
        { provider: "openai", providerModelId: "gpt-4o-mini" },
      ],
      snap
    );

    expect(ordered.map((b) => b.provider)).toEqual(["openai"]);
  });

  it("skips mock-only providers from live routing order", () => {
    const snap = snapshotWith((s) => {
      const openai = s.providers.get("openai")!;
      s.providers.set("openai", { ...openai, mockOnly: true });
    });

    const ordered = filterAndOrderBindings(
      [
        { provider: "openai", providerModelId: "gpt-4o-mini" },
        { provider: "openrouter", providerModelId: "openai/gpt-4o-mini" },
      ],
      snap
    );

    expect(ordered.map((b) => b.provider)).toEqual(["openrouter"]);
  });

  it("orders by fallback priority (lower first)", () => {
    const snap = snapshotWith((s) => {
      s.providers.set("openrouter", {
        ...s.providers.get("openrouter")!,
        fallbackPriority: 50,
      });
      s.providers.set("openai", {
        ...s.providers.get("openai")!,
        fallbackPriority: 5,
      });
    });

    const ordered = filterAndOrderBindings(
      [
        { provider: "openrouter", providerModelId: "openai/gpt-4o" },
        { provider: "openai", providerModelId: "gpt-4o" },
      ],
      snap
    );

    expect(ordered[0]?.provider).toBe("openai");
  });

  it("rejects disabled models on explicit selection", () => {
    const snap = snapshotWith((s) => {
      s.models.set("anthropic.claude-3.5-sonnet", {
        ...s.models.get("anthropic.claude-3.5-sonnet")!,
        enabled: false,
      });
    });

    expect(() =>
      resolveRoute(
        { type: "model", modelId: "anthropic.claude-3.5-sonnet" },
        { purpose: "chat", input: { messages: [] } },
        snap
      )
    ).toThrow(/disabled model/);
  });

  it("rejects frontier models when frontier eligibility is off", () => {
    const snap = snapshotWith((s) => {
      s.models.set("anthropic.claude-3.5-sonnet", {
        ...s.models.get("anthropic.claude-3.5-sonnet")!,
        frontierEligible: false,
        autoEligible: false,
      });
    });

    expect(() =>
      resolveRoute(
        { type: "model", modelId: "anthropic.claude-3.5-sonnet" },
        { purpose: "chat", input: { messages: [] } },
        snap
      )
    ).toThrow(/disabled model/);
  });

  it("excludes non-auto-eligible models from Auto routing", () => {
    const snap = snapshotWith((s) => {
      for (const [id, row] of s.models) {
        s.models.set(id, { ...row, autoEligible: id === "openai.gpt-4o-mini" });
      }
    });
    setProviderOpsSnapshotCache(snap);

    const decision = resolveRoute(
      { type: "auto" },
      {
        purpose: "chat",
        input: { messages: [{ role: "user", content: "hello" }] },
      },
      snap
    );

    expect(decision.modelId).toBe("openai.gpt-4o-mini");
  });

  it("reports configured status without exposing keys", () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test-not-for-display";
    expect(isProviderConfigured("openai")).toBe(true);
    process.env.OPENAI_API_KEY = "";
    expect(isProviderConfigured("openai")).toBe(false);
    process.env.OPENAI_API_KEY = prev;
  });

  it("treats mock as always configured", () => {
    expect(isProviderConfigured("mock")).toBe(true);
  });
});
