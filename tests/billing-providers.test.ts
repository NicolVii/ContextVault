import { describe, expect, it } from "vitest";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  getCreditPack,
  getSubscriptionPlan,
} from "../src/lib/billing/products";
import { listAdapters, getAdapter } from "../src/lib/inference/adapters";
import { resolveModelProfile } from "../src/lib/inference/models";
import { BYOK_PROVIDERS } from "../src/lib/billing/byok-providers";

describe("billing products", () => {
  it("exposes credit packs and plans", () => {
    expect(CREDIT_PACKS.length).toBeGreaterThanOrEqual(3);
    expect(getCreditPack("pack_100k")?.credits).toBe(100_000);
    expect(getSubscriptionPlan("pro")?.monthlyCredits).toBe(500_000);
    expect(SUBSCRIPTION_PLANS.map((p) => p.id)).toContain("free");
  });
});

describe("provider adapters", () => {
  it("registers openrouter, openai, anthropic, google, groq, mock", () => {
    const names = listAdapters();
    for (const n of ["openrouter", "openai", "anthropic", "google", "groq", "mock"]) {
      expect(names).toContain(n);
      expect(getAdapter(n)?.name).toBe(n);
    }
  });

  it("exposes multi-provider bindings on curated models", () => {
    const mini = resolveModelProfile("openai.gpt-4o-mini");
    expect(mini?.bindings.map((b) => b.provider)).toEqual(
      expect.arrayContaining(["openrouter", "openai"])
    );
    const claude = resolveModelProfile("anthropic.claude-3.5-sonnet");
    expect(claude?.bindings.map((b) => b.provider)).toEqual(
      expect.arrayContaining(["openrouter", "anthropic"])
    );
  });
});

describe("byok providers", () => {
  it("lists supported BYOK providers", () => {
    expect(BYOK_PROVIDERS).toContain("openai");
    expect(BYOK_PROVIDERS).toContain("anthropic");
  });
});
