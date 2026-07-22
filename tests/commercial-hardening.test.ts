/**
 * Hardening suite: admin RBAC matrix, demo/disabled Stripe isolation,
 * secret hygiene, plan limits, promotions demo mapping, provider disable,
 * mock fallback, and Stripe lifecycle helpers (pure / env-injected).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  assertCheckoutAllowed,
  assertPortalAllowed,
  evaluateLiveConfigReadiness,
  getCommercialCapabilities,
  isStripePaymentsEnabled,
  resolveCommercialMode,
} from "../src/lib/billing/commercial";
import {
  resolveCheckoutDiscountFromPromotion,
  syncPromotionPriceToStripe,
} from "../src/lib/billing/promotions-stripe";
import type { PromotionRecord } from "../src/lib/billing/promotions-types";
import { PLAN_ENTITLEMENTS } from "../src/lib/billing/entitlements";
import {
  evaluatePlanTurnGate,
  PlanUsageBlockedError,
} from "../src/lib/billing/plan-usage";
import {
  subscriptionSnapshotFromStripe,
} from "../src/lib/billing/subscription-sync";
import { evaluateRoleAccess, type AppRole } from "../src/lib/admin/roles";
import {
  filterAndOrderBindings,
  getDefaultProviderOpsSnapshot,
  invalidateProviderOpsCache,
  setProviderOpsSnapshotCache,
} from "../src/lib/inference/provider-ops";
import { resolveRoute } from "../src/lib/inference/router";
import {
  getChatProvider,
  resetChatProviderCache,
} from "../src/lib/ai";
import type Stripe from "stripe";

function env(partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return partial as NodeJS.ProcessEnv;
}

function liveReadyEnv(
  overrides: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  return env({
    NODE_ENV: "production",
    COMMERCIAL_MODE: "live",
    STRIPE_SECRET_KEY: "sk_test_hardening_secret_value_do_not_leak",
    STRIPE_WEBHOOK_SECRET: "whsec_hardening_secret_value_do_not_leak",
    STRIPE_PRICE_LITE_MONTHLY: "price_lite_m",
    STRIPE_PRICE_LITE_ANNUAL: "price_lite_a",
    STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
    STRIPE_PRICE_PRO_ANNUAL: "price_pro_a",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    ...overrides,
  });
}

/** Mirrors `src/app/api/admin/**` requireApiRole minima. */
const ADMIN_API_RBAC: Array<{
  method: string;
  path: string;
  minimum: AppRole;
}> = [
  { method: "GET", path: "/api/admin/session", minimum: "support" },
  { method: "GET", path: "/api/admin/overview", minimum: "support" },
  { method: "GET", path: "/api/admin/users", minimum: "support" },
  { method: "GET", path: "/api/admin/users/:id", minimum: "support" },
  { method: "POST", path: "/api/admin/users/:id/actions", minimum: "admin" },
  { method: "POST", path: "/api/admin/entitlements", minimum: "admin" },
  { method: "GET", path: "/api/admin/audit", minimum: "support" },
  { method: "GET", path: "/api/admin/usage", minimum: "support" },
  { method: "GET", path: "/api/admin/plans", minimum: "support" },
  { method: "GET", path: "/api/admin/plans/:id", minimum: "support" },
  { method: "POST", path: "/api/admin/plans/:id", minimum: "admin" },
  { method: "POST", path: "/api/admin/plans/campaigns", minimum: "admin" },
  { method: "GET", path: "/api/admin/promotions", minimum: "support" },
  { method: "POST", path: "/api/admin/promotions", minimum: "admin" },
  { method: "PATCH", path: "/api/admin/promotions", minimum: "admin" },
  { method: "POST", path: "/api/admin/promotions/redemptions", minimum: "admin" },
  { method: "GET", path: "/api/admin/providers", minimum: "support" },
  { method: "PATCH", path: "/api/admin/providers/:id", minimum: "admin" },
  { method: "POST", path: "/api/admin/providers/:id/health", minimum: "admin" },
  { method: "PATCH", path: "/api/admin/models/:id", minimum: "admin" },
  { method: "GET", path: "/api/admin/system", minimum: "support" },
  { method: "PATCH", path: "/api/admin/system", minimum: "admin" },
  { method: "GET", path: "/api/admin/billing/readiness", minimum: "support" },
  { method: "POST", path: "/api/admin/billing/readiness", minimum: "admin" },
];

describe("admin API RBAC matrix", () => {
  it("denies unauthenticated callers on every admin route minimum", () => {
    for (const route of ADMIN_API_RBAC) {
      expect(
        evaluateRoleAccess(false, null, route.minimum),
        `${route.method} ${route.path}`
      ).toBe("unauthorized");
    }
  });

  it("denies normal users from every admin route minimum", () => {
    for (const route of ADMIN_API_RBAC) {
      expect(
        evaluateRoleAccess(true, "user", route.minimum),
        `${route.method} ${route.path}`
      ).toBe("forbidden");
    }
  });

  it("allows support only on support-minimum routes", () => {
    for (const route of ADMIN_API_RBAC) {
      const decision = evaluateRoleAccess(true, "support", route.minimum);
      if (route.minimum === "support") {
        expect(decision, `${route.method} ${route.path}`).toBe("allow");
      } else {
        expect(decision, `${route.method} ${route.path}`).toBe("forbidden");
      }
    }
  });

  it("allows admin on admin+support routes but not super_admin-only", () => {
    expect(evaluateRoleAccess(true, "admin", "admin")).toBe("allow");
    expect(evaluateRoleAccess(true, "admin", "support")).toBe("allow");
    expect(evaluateRoleAccess(true, "admin", "super_admin")).toBe("forbidden");
  });

  it("gates /api/admin/actions by action name", () => {
    const actionMinima: Array<{ action: string; minimum: AppRole }> = [
      { action: "staff_ping", minimum: "support" },
      { action: "admin_ping", minimum: "admin" },
      { action: "super_only", minimum: "super_admin" },
    ];
    for (const { action, minimum } of actionMinima) {
      expect(
        evaluateRoleAccess(true, "user", minimum),
        action
      ).toBe("forbidden");
      expect(
        evaluateRoleAccess(true, "support", minimum) === "allow",
        `support→${action}`
      ).toBe(minimum === "support");
      expect(
        evaluateRoleAccess(true, "admin", minimum) === "allow",
        `admin→${action}`
      ).toBe(minimum !== "super_admin");
      expect(evaluateRoleAccess(true, "super_admin", minimum)).toBe("allow");
    }
  });
});

describe("demo and disabled modes never contact Stripe", () => {
  it("blocks Checkout and Portal even when live-ready Stripe env is present", () => {
    for (const mode of ["demo", "disabled"] as const) {
      const e = liveReadyEnv({
        NODE_ENV: "development",
        COMMERCIAL_MODE: mode,
      });
      expect(resolveCommercialMode(e)).toBe(mode);
      expect(isStripePaymentsEnabled(e)).toBe(false);
      expect(assertCheckoutAllowed(e).ok).toBe(false);
      expect(assertPortalAllowed(e).ok).toBe(false);
      const caps = getCommercialCapabilities(e);
      expect(caps.checkoutEnabled).toBe(false);
      expect(caps.portalEnabled).toBe(false);
    }
  });

  it("promotions sync returns demo simulation and never live coupon ids outside live", async () => {
    const promo = {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "hardening-promo",
      name: "Hardening Promo",
      code: "HARDEN20",
      distribution: "public_code" as const,
      maxRedemptions: 10,
      priceEffect: {
        type: "percentage" as const,
        percentOff: 20,
        duration: "once" as const,
      },
    };

    for (const mode of ["demo", "disabled"] as const) {
      const result = await syncPromotionPriceToStripe({
        promotion: promo,
        env: liveReadyEnv({
          NODE_ENV: "development",
          COMMERCIAL_MODE: mode,
        }),
      });
      expect(result.mode).toBe(mode);
      expect(result.stripeCouponId).toBeNull();
      expect(result.stripePromotionCodeId).toBeNull();
      expect(result.demoStripeSimulation?.simulated).toBe(true);
      expect(result.demoStripeSimulation?.couponId).toMatch(/^demo_coupon_/);
    }
  });

  it("checkout discount resolver never emits live Stripe discounts in demo", () => {
    const promotion = {
      priceEffect: {
        type: "percentage" as const,
        percentOff: 15,
        duration: "once" as const,
      },
      stripeCouponId: "coupon_should_not_be_used",
      stripePromotionCodeId: "promo_should_not_be_used",
      demoStripeSimulation: {
        simulated: true as const,
        couponId: "demo_coupon_x",
        promotionCodeId: "demo_promo_x",
        mappedAt: "2026-07-22T00:00:00.000Z",
        priceEffect: {
          type: "percentage" as const,
          percentOff: 15,
          duration: "once" as const,
        },
      },
    } satisfies Pick<
      PromotionRecord,
      | "priceEffect"
      | "stripeCouponId"
      | "stripePromotionCodeId"
      | "demoStripeSimulation"
    >;

    const mapped = resolveCheckoutDiscountFromPromotion({
      promotion,
      env: liveReadyEnv({
        NODE_ENV: "development",
        COMMERCIAL_MODE: "demo",
      }),
    });
    expect(mapped.liveDiscounts).toBeNull();
    expect(mapped.demoSimulatedDiscount?.simulated).toBe(true);
  });
});

describe("secret protection", () => {
  it("live readiness report never embeds Stripe secret or webhook secret values", () => {
    const secret = "sk_test_hardening_secret_value_do_not_leak";
    const whsec = "whsec_hardening_secret_value_do_not_leak";
    const report = evaluateLiveConfigReadiness(
      liveReadyEnv({
        STRIPE_SECRET_KEY: secret,
        STRIPE_WEBHOOK_SECRET: whsec,
      })
    );
    const blob = JSON.stringify(report);
    expect(blob).not.toContain(secret);
    expect(blob).not.toContain(whsec);
    expect(blob).not.toMatch(/sk_test_hardening_secret/);
    expect(blob).not.toMatch(/whsec_hardening_secret/);
    expect(report.ready).toBe(true);
    expect(
      report.checks.find((c) => c.id === "stripe_secret")?.detail
    ).toMatch(/present/i);
  });

  it("denial payloads also omit secrets", () => {
    const secret = "sk_test_denied_secret_abcdef";
    const denied = assertCheckoutAllowed(
      liveReadyEnv({
        COMMERCIAL_MODE: "demo",
        NODE_ENV: "development",
        STRIPE_SECRET_KEY: secret,
      })
    );
    expect(denied.ok).toBe(false);
    expect(JSON.stringify(denied)).not.toContain(secret);
  });
});

describe("plan limits (evaluatePlanTurnGate)", () => {
  const free = PLAN_ENTITLEMENTS.free;
  const lite = PLAN_ENTITLEMENTS.lite;
  const pro = PLAN_ENTITLEMENTS.pro;

  it("blocks Frontier on Free", () => {
    expect(() =>
      evaluatePlanTurnGate({
        inferenceRestricted: false,
        entitlements: free,
        autoRemaining: 30,
        frontierRemaining: 0,
        autoCredits: 0,
        frontierCredits: 0,
        intensity: "frontier",
        estimatedCredits: 100,
      })
    ).toThrow(PlanUsageBlockedError);
    try {
      evaluatePlanTurnGate({
        inferenceRestricted: false,
        entitlements: free,
        autoRemaining: 30,
        frontierRemaining: 0,
        autoCredits: 0,
        frontierCredits: 0,
        intensity: "frontier",
        estimatedCredits: 100,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(PlanUsageBlockedError);
      expect((err as PlanUsageBlockedError).code).toBe("frontier_blocked");
    }
  });

  it("blocks Auto when Free monthly turns are exhausted", () => {
    try {
      evaluatePlanTurnGate({
        inferenceRestricted: false,
        entitlements: free,
        autoRemaining: 0,
        frontierRemaining: 0,
        autoCredits: 0,
        frontierCredits: 0,
        intensity: "auto",
        estimatedCredits: 10,
      });
      expect.fail("expected block");
    } catch (err) {
      expect((err as PlanUsageBlockedError).code).toBe("auto_exhausted");
    }
  });

  it("blocks Lite Frontier when remaining turns are zero", () => {
    try {
      evaluatePlanTurnGate({
        inferenceRestricted: false,
        entitlements: lite,
        autoRemaining: null,
        frontierRemaining: 0,
        autoCredits: 0,
        frontierCredits: 0,
        intensity: "frontier",
        estimatedCredits: 100,
      });
      expect.fail("expected block");
    } catch (err) {
      expect((err as PlanUsageBlockedError).code).toBe("frontier_exhausted");
    }
  });

  it("blocks Lite Frontier over per-turn credit cap", () => {
    try {
      evaluatePlanTurnGate({
        inferenceRestricted: false,
        entitlements: lite,
        autoRemaining: null,
        frontierRemaining: 5,
        autoCredits: 0,
        frontierCredits: 0,
        intensity: "frontier",
        estimatedCredits: lite.maxFrontierCreditsPerTurn + 1,
      });
      expect.fail("expected block");
    } catch (err) {
      expect((err as PlanUsageBlockedError).code).toBe("per_turn_cap");
    }
  });

  it("blocks Pro Frontier when soft credit cap would be exceeded", () => {
    try {
      evaluatePlanTurnGate({
        inferenceRestricted: false,
        entitlements: pro,
        autoRemaining: null,
        frontierRemaining: null,
        autoCredits: 0,
        frontierCredits: (pro.frontierSoftCreditCap ?? 0) - 10,
        intensity: "frontier",
        estimatedCredits: 20,
      });
      expect.fail("expected block");
    } catch (err) {
      expect((err as PlanUsageBlockedError).code).toBe("fair_use");
    }
  });

  it("blocks all turns when inference is restricted (grace expired)", () => {
    try {
      evaluatePlanTurnGate({
        inferenceRestricted: true,
        entitlements: pro,
        autoRemaining: null,
        frontierRemaining: null,
        autoCredits: 0,
        frontierCredits: 0,
        intensity: "auto",
        estimatedCredits: 10,
      });
      expect.fail("expected block");
    } catch (err) {
      expect((err as PlanUsageBlockedError).code).toBe("restricted");
    }
  });

  it("allows Lite Frontier within remaining turns and per-turn cap", () => {
    expect(() =>
      evaluatePlanTurnGate({
        inferenceRestricted: false,
        entitlements: lite,
        autoRemaining: null,
        frontierRemaining: 3,
        autoCredits: 0,
        frontierCredits: 0,
        intensity: "frontier",
        estimatedCredits: 500,
      })
    ).not.toThrow();
  });
});

describe("provider disabling and mock fallback", () => {
  afterEach(() => {
    invalidateProviderOpsCache();
    delete process.env.OPENROUTER_API_KEY;
    resetChatProviderCache();
  });

  it("removes disabled providers from routing order", () => {
    const snap = getDefaultProviderOpsSnapshot();
    snap.providers.set("openrouter", {
      ...snap.providers.get("openrouter")!,
      enabled: false,
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

  it("keeps mock provider available as last-resort configured adapter", () => {
    const snap = getDefaultProviderOpsSnapshot();
    expect(snap.providers.get("mock")?.mockOnly).toBe(true);
    expect(snap.providers.get("mock")?.enabled).toBe(true);
  });

  it("chat provider falls back to mock when no OpenRouter key", () => {
    delete process.env.OPENROUTER_API_KEY;
    resetChatProviderCache();
    expect(getChatProvider().name).toBe("mock");
  });

  it("rejects explicit selection of a disabled model", () => {
    const snap = getDefaultProviderOpsSnapshot();
    snap.models.set("openai.gpt-4o-mini", {
      ...snap.models.get("openai.gpt-4o-mini")!,
      enabled: false,
    });
    setProviderOpsSnapshotCache(snap);
    expect(() =>
      resolveRoute(
        { type: "model", modelId: "openai.gpt-4o-mini" },
        { purpose: "chat", input: { messages: [] } },
        snap
      )
    ).toThrow(/disabled model/);
  });
});

describe("Stripe subscription cancel mapping (pure)", () => {
  it("maps canceled Stripe status without inventing an unpaid upgrade", () => {
    const snap = subscriptionSnapshotFromStripe("user_1", {
      id: "sub_cancel",
      object: "subscription",
      status: "canceled",
      cancel_at_period_end: false,
      customer: "cus_1",
      metadata: { cortaix_user_id: "user_1", plan_id: "lite" },
      items: {
        object: "list",
        data: [
          {
            id: "si_1",
            object: "subscription_item",
            price: { id: "price_x", object: "price" },
            current_period_end: 1_785_000_000,
          },
        ],
        has_more: false,
        url: "",
      },
      current_period_end: 1_785_000_000,
    } as unknown as Stripe.Subscription);

    expect(snap.status).toBe("canceled");
    expect(snap.planId).toBe("lite");
  });
});

describe("temporary grants vs paid revenue flags", () => {
  it("demo capabilities keep checkout off while top-up may stay on", () => {
    const caps = getCommercialCapabilities(
      env({ NODE_ENV: "development", COMMERCIAL_MODE: "demo" })
    );
    expect(caps.mode).toBe("demo");
    expect(caps.checkoutEnabled).toBe(false);
    expect(caps.devTopupAllowed).toBe(true);
  });

  it("disabled mode turns off checkout and dev top-up", () => {
    const caps = getCommercialCapabilities(
      env({ NODE_ENV: "development", COMMERCIAL_MODE: "disabled" })
    );
    expect(caps.checkoutEnabled).toBe(false);
    expect(caps.devTopupAllowed).toBe(false);
  });
});
