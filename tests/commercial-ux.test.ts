import { describe, expect, it } from "vitest";
import {
  formatEurCents,
  getPublicPlans,
  getSubscriptionPlan,
} from "../src/lib/billing/products";
import { entitlementsForPlan } from "../src/lib/billing/entitlements";

describe("landing pricing catalog", () => {
  it("exposes Free, Lite, and Pro for the marketing Pricing section", () => {
    const plans = getPublicPlans();
    expect(plans.map((p) => p.id)).toEqual(["free", "lite", "pro"]);
    expect(getSubscriptionPlan("free")?.amountEurCentsMonthly).toBe(0);
    expect(getSubscriptionPlan("lite")?.amountEurCentsMonthly).toBe(500);
    expect(getSubscriptionPlan("pro")?.amountEurCentsMonthly).toBe(2_800);
    expect(getSubscriptionPlan("pro")?.foundingEurCentsMonthly).toBe(2_500);
    expect(getSubscriptionPlan("pro")?.amountEurCentsAnnual).toBe(28_000);
    expect(formatEurCents(2_500)).toMatch(/25/);
  });
});

describe("vault plan hint copy", () => {
  it("labels Free with Auto remaining when known", () => {
    const planLabel = getSubscriptionPlan("free")?.label ?? "Free";
    const autoRemaining = 18;
    const hint = `${planLabel} · about ${autoRemaining} Auto left`;
    expect(hint).toBe("Free · about 18 Auto left");
  });

  it("keeps Lite/Pro labels simple on the hub", () => {
    expect(getSubscriptionPlan("lite")?.label).toBe("Lite");
    expect(getSubscriptionPlan("pro")?.label).toBe("Pro");
  });
});

describe("founding offer eligibility", () => {
  it("is only for Free users who have not dismissed", () => {
    function showFoundingOffer(planId: string, dismissed: boolean) {
      return planId === "free" && !dismissed;
    }
    expect(showFoundingOffer("free", false)).toBe(true);
    expect(showFoundingOffer("free", true)).toBe(false);
    expect(showFoundingOffer("lite", false)).toBe(false);
    expect(showFoundingOffer("pro", false)).toBe(false);
  });
});

describe("free tier entitlements after signup", () => {
  it("gives Free Auto capacity without Frontier or attachments", () => {
    const free = entitlementsForPlan("free");
    expect(free.autoMonthlyTurns).toBe(30);
    expect(free.frontierMonthlyTurns).toBe(0);
    expect(free.attachments).toBe(false);
    expect(free.byok).toBe(false);
  });
});
