import { describe, expect, it } from "vitest";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  getCreditPack,
  getSubscriptionPlan,
  getPublicPlans,
  formatEurCents,
} from "../src/lib/billing/products";
import { PLAN_ENTITLEMENTS, entitlementsForPlan } from "../src/lib/billing/entitlements";
import {
  classifyUsageIntensity,
  isFrontierModelId,
} from "../src/lib/billing/usage-intensity";
import { listAdapters, getAdapter } from "../src/lib/inference/adapters";
import { resolveModelProfile } from "../src/lib/inference/models";
import { BYOK_PROVIDERS } from "../src/lib/billing/byok-providers";
import { DEFAULT_SIGNUP_CREDITS } from "../src/lib/billing/constants";

describe("billing products", () => {
  it("exposes Free, Lite, and Pro only on the public storefront", () => {
    expect(getPublicPlans().map((p) => p.id)).toEqual(["free", "lite", "pro"]);
    expect(getSubscriptionPlan("lite")?.amountEurCentsMonthly).toBe(500);
    expect(getSubscriptionPlan("pro")?.amountEurCentsMonthly).toBe(2_800);
    expect(getSubscriptionPlan("pro")?.foundingEurCentsMonthly).toBe(2_500);
    expect(SUBSCRIPTION_PLANS.every((p) => p.public)).toBe(true);
    expect(formatEurCents(500)).toContain("5");
  });

  it("keeps optional packs off the public storefront by default", () => {
    expect(CREDIT_PACKS.every((p) => !p.public)).toBe(true);
    expect(getCreditPack("pack_frontier_boost")?.credits).toBe(100_000);
  });

  it("does not advertise Team or Max", () => {
    expect(SUBSCRIPTION_PLANS.map((p) => p.id)).not.toContain("team");
    expect(SUBSCRIPTION_PLANS.map((p) => p.id)).not.toContain("max");
  });
});

describe("plan entitlements", () => {
  it("locks Free attachments and Frontier; Lite counts Frontier; Pro enables BYOK", () => {
    expect(PLAN_ENTITLEMENTS.free.attachments).toBe(false);
    expect(PLAN_ENTITLEMENTS.free.frontierMonthlyTurns).toBe(0);
    expect(PLAN_ENTITLEMENTS.free.autoMonthlyTurns).toBe(30);
    expect(PLAN_ENTITLEMENTS.lite.frontierMonthlyTurns).toBe(10);
    expect(PLAN_ENTITLEMENTS.lite.unlimitedAuto).toBe(true);
    expect(PLAN_ENTITLEMENTS.lite.storageBytes).toBe(100 * 1024 * 1024);
    expect(PLAN_ENTITLEMENTS.pro.byok).toBe(true);
    expect(PLAN_ENTITLEMENTS.pro.voice).toBe(true);
    expect(PLAN_ENTITLEMENTS.pro.frontierMonthlyTurns).toBeNull();
    expect(entitlementsForPlan("team").planId).toBe("free");
  });

  it("uses a small signup credit bootstrap", () => {
    expect(DEFAULT_SIGNUP_CREDITS).toBe(3_000);
  });
});

describe("usage intensity", () => {
  it("classifies Auto selection as auto and Claude as frontier", () => {
    expect(classifyUsageIntensity({ type: "auto" }, "openai.gpt-4o")).toBe("auto");
    expect(isFrontierModelId("anthropic.claude-3.5-sonnet")).toBe(true);
    expect(isFrontierModelId("openai.gpt-4o-mini")).toBe(false);
    expect(
      classifyUsageIntensity(
        { type: "model", modelId: "anthropic.claude-3.5-sonnet" },
        "anthropic.claude-3.5-sonnet"
      )
    ).toBe("frontier");
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
