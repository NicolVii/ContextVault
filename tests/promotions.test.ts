import { describe, expect, it } from "vitest";
import {
  applyPromotionBonusOverlays,
  resolveEffectiveEntitlement,
} from "../src/lib/billing/entitlement-resolution";
import {
  evaluatePromotionEligibility,
  isPromotionWindowOpen,
  normalizePromotionCode,
} from "../src/lib/billing/promotions";
import {
  bonusEffectSchema,
  priceEffectSchema,
  promotionInputSchema,
  type PromotionRecord,
} from "../src/lib/billing/promotions-types";
import { resolveCheckoutDiscountFromPromotion } from "../src/lib/billing/promotions-stripe";
import { entitlementsForPlan } from "../src/lib/billing/entitlements";

function basePromo(
  overrides: Partial<PromotionRecord> = {}
): PromotionRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "test-promo",
    name: "Test Promo",
    description: null,
    status: "active",
    distribution: "public_code",
    code: "TEST20",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-12-31T00:00:00.000Z",
    pausedAt: null,
    maxRedemptions: 100,
    maxRedemptionsPerUser: 1,
    eligiblePlans: [],
    audience: "all",
    priceEffect: {
      type: "percentage",
      percentOff: 20,
      duration: "once",
    },
    bonusEffect: {
      frontierTurnBonus: 10,
      durationDays: 30,
    },
    stripeCouponId: null,
    stripePromotionCodeId: null,
    demoStripeSimulation: {
      simulated: true,
      couponId: "demo_coupon_abc",
      promotionCodeId: "demo_promo_abc",
      mappedAt: "2026-07-22T00:00:00.000Z",
      priceEffect: {
        type: "percentage",
        percentOff: 20,
        duration: "once",
      },
    },
    redemptionCount: 0,
    reason: "unit test",
    createdBy: null,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("promotions validation", () => {
  it("accepts percentage and fixed price effects", () => {
    expect(
      priceEffectSchema.parse({
        type: "percentage",
        percentOff: 25,
        duration: "once",
      }).type
    ).toBe("percentage");
    expect(
      priceEffectSchema.parse({
        type: "fixed",
        amountOffEurCents: 500,
        duration: "repeating",
        durationInMonths: 3,
      }).type
    ).toBe("fixed");
    expect(
      priceEffectSchema.parse({ type: "trial", trialDays: 14 })
    ).toMatchObject({ type: "trial", trialDays: 14 });
    expect(
      priceEffectSchema.parse({
        type: "limited_periods",
        billingPeriods: 2,
      })
    ).toMatchObject({ type: "limited_periods", percentOff: 100 });
  });

  it("rejects empty bonus effects", () => {
    const parsed = bonusEffectSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("requires code for public_code and forbids code for automatic", () => {
    const ok = promotionInputSchema.safeParse({
      slug: "summer-boost",
      name: "Summer",
      distribution: "public_code",
      code: "SUMMER20",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-08-01T00:00:00.000Z",
      bonusEffect: { frontierTurnBonus: 5 },
      reason: "launch summer",
    });
    expect(ok.success).toBe(true);

    const missingCode = promotionInputSchema.safeParse({
      slug: "summer-boost",
      name: "Summer",
      distribution: "public_code",
      startsAt: "2026-07-01T00:00:00.000Z",
      bonusEffect: { frontierTurnBonus: 5 },
      reason: "launch summer",
    });
    expect(missingCode.success).toBe(false);

    const autoWithCode = promotionInputSchema.safeParse({
      slug: "auto-boost",
      name: "Auto",
      distribution: "automatic",
      code: "NOPE",
      startsAt: "2026-07-01T00:00:00.000Z",
      bonusEffect: { autoTurnBonus: 5 },
      reason: "auto campaign",
    });
    expect(autoWithCode.success).toBe(false);
  });

  it("normalizes codes to uppercase", () => {
    expect(normalizePromotionCode("  summer20 ")).toBe("SUMMER20");
  });
});

describe("promotion window and eligibility", () => {
  it("detects open window and paused/ended states", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");
    expect(isPromotionWindowOpen(basePromo(), now)).toBe(true);
    expect(
      isPromotionWindowOpen(basePromo({ status: "paused", pausedAt: now.toISOString() }), now)
    ).toBe(false);
    expect(
      isPromotionWindowOpen(basePromo({ endsAt: "2026-07-01T00:00:00.000Z" }), now)
    ).toBe(false);
  });

  it("enforces eligible plans and audience", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");
    const promo = basePromo({ eligiblePlans: ["lite", "pro"] });
    expect(
      evaluatePromotionEligibility(
        promo,
        {
          userId: "u1",
          planId: "free",
          userCreatedAt: "2026-01-01T00:00:00.000Z",
        },
        now
      ).ok
    ).toBe(false);

    expect(
      evaluatePromotionEligibility(
        promo,
        {
          userId: "u1",
          planId: "lite",
          userCreatedAt: "2026-01-01T00:00:00.000Z",
        },
        now
      ).ok
    ).toBe(true);

    const newOnly = basePromo({ audience: "new_users" });
    expect(
      evaluatePromotionEligibility(
        newOnly,
        {
          userId: "u1",
          planId: "free",
          userCreatedAt: "2026-01-01T00:00:00.000Z",
          hasHadPaidSubscription: true,
        },
        now
      ).ok
    ).toBe(false);

    expect(
      evaluatePromotionEligibility(
        newOnly,
        {
          userId: "u1",
          planId: "free",
          userCreatedAt: "2026-07-20T00:00:00.000Z",
          hasHadPaidSubscription: false,
        },
        now
      ).ok
    ).toBe(true);
  });
});

describe("promotion bonus stacking", () => {
  it("stacks bonuses onto subscription without flipping demo flags", () => {
    const resolved = resolveEffectiveEntitlement({
      subscription: {
        planId: "lite",
        status: "active",
        currentPeriodEnd: "2026-08-22T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
      promotionBonuses: [
        {
          id: "r1",
          autoTurnBonus: 0,
          frontierTurnBonus: 15,
          storageBytesBonus: 50_000_000,
          featureOverrides: { attachments: true },
          expiresAt: null,
        },
      ],
    });

    expect(resolved.source).toBe("subscription");
    expect(resolved.isDemo).toBe(false);
    expect(resolved.excludeFromRevenue).toBe(false);
    expect(resolved.entitlements.frontierMonthlyTurns).toBe(
      (entitlementsForPlan("lite").frontierMonthlyTurns ?? 0) + 15
    );
    expect(resolved.entitlements.storageBytes).toBe(
      entitlementsForPlan("lite").storageBytes + 50_000_000
    );
    expect(resolved.promotionRedemptionIds).toEqual(["r1"]);
  });

  it("ignores expired overlays", () => {
    const base = resolveEffectiveEntitlement({
      subscription: {
        planId: "pro",
        status: "active",
        currentPeriodEnd: "2026-08-22T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    });
    const withExpired = applyPromotionBonusOverlays(
      base,
      [
        {
          id: "old",
          autoTurnBonus: 100,
          frontierTurnBonus: 0,
          storageBytesBonus: 0,
          featureOverrides: {},
          expiresAt: "2020-01-01T00:00:00.000Z",
        },
      ],
      new Date("2026-07-22T00:00:00.000Z")
    );
    expect(withExpired.entitlements.autoMonthlyTurns).toBe(
      base.entitlements.autoMonthlyTurns
    );
    expect(withExpired.promotionRedemptionIds).toEqual([]);
  });
});

describe("demo vs live Stripe mapping helpers", () => {
  it("returns demo simulation for checkout helpers when not live", () => {
    const promo = basePromo();
    const result = resolveCheckoutDiscountFromPromotion({
      promotion: promo,
      env: { NODE_ENV: "development", COMMERCIAL_MODE: "demo" },
    });
    expect(result.liveDiscounts).toBeNull();
    expect(result.demoSimulatedDiscount?.couponId).toBe("demo_coupon_abc");
  });

  it("returns live coupon discounts when configured", () => {
    const promo = basePromo({
      stripeCouponId: "coup_live_123",
      demoStripeSimulation: null,
    });
    const result = resolveCheckoutDiscountFromPromotion({
      promotion: promo,
      env: {
        NODE_ENV: "development",
        COMMERCIAL_MODE: "live",
        STRIPE_SECRET_KEY: "sk_test_x",
      },
    });
    expect(result.liveDiscounts).toEqual([{ coupon: "coup_live_123" }]);
    expect(result.demoSimulatedDiscount).toBeNull();
  });

  it("maps trial days without requiring a coupon", () => {
    const promo = basePromo({
      priceEffect: { type: "trial", trialDays: 7 },
      demoStripeSimulation: null,
    });
    const result = resolveCheckoutDiscountFromPromotion({
      promotion: promo,
      env: {
        NODE_ENV: "development",
        COMMERCIAL_MODE: "live",
        STRIPE_SECRET_KEY: "sk_test_x",
      },
    });
    expect(result.trialDays).toBe(7);
    expect(result.liveDiscounts).toBeNull();
  });
});
