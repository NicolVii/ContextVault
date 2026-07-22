import { describe, expect, it } from "vitest";
import {
  evaluateLiveConfigReadiness,
  assertLiveConfigAllowed,
  isStripeTestSecret,
  isStripeLiveSecret,
  requiredStripePriceEnvKeys,
} from "../src/lib/billing/live-readiness";
import {
  assertCheckoutAllowed,
  isStripePaymentsEnabled,
  getCommercialCapabilities,
} from "../src/lib/billing/commercial";
import { subscriptionRowsDiffer } from "../src/lib/billing/subscription-sync";

function env(partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return partial as NodeJS.ProcessEnv;
}

/** Minimal live-ready Stripe *test* configuration. */
function liveTestEnv(
  overrides: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  return env({
    NODE_ENV: "production",
    COMMERCIAL_MODE: "live",
    STRIPE_SECRET_KEY: "sk_test_live_readiness_unit",
    STRIPE_WEBHOOK_SECRET: "whsec_test_unit",
    STRIPE_PRICE_LITE_MONTHLY: "price_lite_m",
    STRIPE_PRICE_LITE_ANNUAL: "price_lite_a",
    STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
    STRIPE_PRICE_PRO_ANNUAL: "price_pro_a",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    ...overrides,
  });
}

describe("required Stripe price env keys", () => {
  it("covers Lite and Pro monthly + annual", () => {
    expect(requiredStripePriceEnvKeys().sort()).toEqual(
      [
        "STRIPE_PRICE_LITE_ANNUAL",
        "STRIPE_PRICE_LITE_MONTHLY",
        "STRIPE_PRICE_PRO_ANNUAL",
        "STRIPE_PRICE_PRO_MONTHLY",
      ].sort()
    );
  });
});

describe("evaluateLiveConfigReadiness", () => {
  it("is not ready outside live mode", () => {
    const report = evaluateLiveConfigReadiness(
      env({
        NODE_ENV: "development",
        COMMERCIAL_MODE: "demo",
        STRIPE_SECRET_KEY: "sk_test_x",
      })
    );
    expect(report.ready).toBe(false);
    expect(report.mode).toBe("demo");
  });

  it("blocks live mode when prices or webhook secret are missing", () => {
    const report = evaluateLiveConfigReadiness(
      env({
        NODE_ENV: "production",
        COMMERCIAL_MODE: "live",
        STRIPE_SECRET_KEY: "sk_test_x",
      })
    );
    expect(report.ready).toBe(false);
    expect(report.blockingReasons.some((r) => /WEBHOOK_SECRET/i.test(r))).toBe(
      true
    );
    expect(report.blockingReasons.some((r) => /LITE_MONTHLY/i.test(r))).toBe(
      true
    );
    expect(assertLiveConfigAllowed(env({
      NODE_ENV: "production",
      COMMERCIAL_MODE: "live",
      STRIPE_SECRET_KEY: "sk_test_x",
    }))).toMatchObject({
      ok: false,
      code: "live_not_ready",
      status: 503,
    });
  });

  it("passes with Stripe test-mode secrets and full config", () => {
    const report = evaluateLiveConfigReadiness(liveTestEnv());
    expect(report.ready).toBe(true);
    expect(report.stripeTestMode).toBe(true);
    expect(report.stripeLiveMode).toBe(false);
    expect(isStripePaymentsEnabled(liveTestEnv())).toBe(true);
    expect(assertCheckoutAllowed(liveTestEnv())).toEqual({ ok: true });
    expect(assertLiveConfigAllowed(liveTestEnv())).toMatchObject({ ok: true });
  });

  it("blocks sk_live_* without STRIPE_ALLOW_LIVE_KEYS", () => {
    const report = evaluateLiveConfigReadiness(
      liveTestEnv({ STRIPE_SECRET_KEY: "sk_live_real_money" })
    );
    expect(report.ready).toBe(false);
    expect(report.stripeLiveMode).toBe(true);
    expect(isStripeLiveSecret(liveTestEnv({ STRIPE_SECRET_KEY: "sk_live_x" }))).toBe(
      true
    );
    expect(
      report.blockingReasons.some((r) => /STRIPE_ALLOW_LIVE_KEYS/i.test(r))
    ).toBe(true);
  });

  it("allows sk_live_* when explicitly acknowledged", () => {
    const report = evaluateLiveConfigReadiness(
      liveTestEnv({
        STRIPE_SECRET_KEY: "sk_live_real_money",
        STRIPE_ALLOW_LIVE_KEYS: "1",
      })
    );
    expect(report.ready).toBe(true);
    expect(report.stripeLiveMode).toBe(true);
  });

  it("requires a valid NEXT_PUBLIC_APP_URL", () => {
    const report = evaluateLiveConfigReadiness(
      liveTestEnv({ NEXT_PUBLIC_APP_URL: "not-a-url" })
    );
    expect(report.ready).toBe(false);
    expect(report.blockingReasons.some((r) => /APP_URL/i.test(r))).toBe(true);
  });
});

describe("Stripe secret mode helpers", () => {
  it("detects test vs live prefixes", () => {
    expect(isStripeTestSecret(env({ STRIPE_SECRET_KEY: "sk_test_abc" }))).toBe(
      true
    );
    expect(isStripeLiveSecret(env({ STRIPE_SECRET_KEY: "sk_test_abc" }))).toBe(
      false
    );
    expect(isStripeLiveSecret(env({ STRIPE_SECRET_KEY: "sk_live_abc" }))).toBe(
      true
    );
  });
});

describe("commercial capabilities reflect live readiness", () => {
  it("keeps checkout off when live but incomplete", () => {
    const caps = getCommercialCapabilities(
      env({
        NODE_ENV: "production",
        COMMERCIAL_MODE: "live",
        STRIPE_SECRET_KEY: "sk_test_x",
      })
    );
    expect(caps.mode).toBe("live");
    expect(caps.stripeConfigured).toBe(true);
    expect(caps.checkoutEnabled).toBe(false);
    expect(caps.liveConfigReady).toBe(false);
  });

  it("enables checkout when live config is complete (test mode)", () => {
    const caps = getCommercialCapabilities(liveTestEnv());
    expect(caps.checkoutEnabled).toBe(true);
    expect(caps.portalEnabled).toBe(true);
    expect(caps.liveConfigReady).toBe(true);
    expect(caps.devTopupAllowed).toBe(false);
  });
});

describe("subscriptionRowsDiffer", () => {
  it("detects plan/status/period drift", () => {
    const desired = {
      userId: "u1",
      stripeSubscriptionId: "sub_1",
      stripePriceId: "price_pro_m",
      planId: "pro",
      status: "active",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    };
    expect(
      subscriptionRowsDiffer(
        {
          stripe_subscription_id: "sub_1",
          stripe_price_id: "price_pro_m",
          plan_id: "pro",
          status: "active",
          current_period_end: "2026-08-01T00:00:00.000Z",
          cancel_at_period_end: false,
        },
        desired
      )
    ).toBe(false);

    expect(
      subscriptionRowsDiffer(
        {
          stripe_subscription_id: "sub_1",
          stripe_price_id: "price_lite_m",
          plan_id: "lite",
          status: "active",
          current_period_end: "2026-08-01T00:00:00.000Z",
          cancel_at_period_end: false,
        },
        desired
      )
    ).toBe(true);

    expect(
      subscriptionRowsDiffer(
        {
          stripe_subscription_id: "sub_1",
          stripe_price_id: "price_pro_m",
          plan_id: "pro",
          status: "past_due",
          current_period_end: "2026-08-01T00:00:00.000Z",
          cancel_at_period_end: true,
        },
        desired
      )
    ).toBe(true);
  });
});
