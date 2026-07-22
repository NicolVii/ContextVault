import { afterEach, describe, expect, it } from "vitest";
import {
  assertCheckoutAllowed,
  assertPortalAllowed,
  getCommercialCapabilities,
  getFeatureFlags,
  isStripePaymentsEnabled,
  resolveCommercialMode,
} from "../src/lib/billing/commercial";
import { isDevTopupAllowed } from "../src/lib/billing/dev-topup";

const stripeKey = "sk_test_commercial_mode_unit";

function env(partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return partial as NodeJS.ProcessEnv;
}

function liveReadyEnv(
  overrides: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  return env({
    NODE_ENV: "production",
    COMMERCIAL_MODE: "live",
    STRIPE_SECRET_KEY: stripeKey,
    STRIPE_WEBHOOK_SECRET: "whsec_commercial_mode_unit",
    STRIPE_PRICE_LITE_MONTHLY: "price_lite_m",
    STRIPE_PRICE_LITE_ANNUAL: "price_lite_a",
    STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
    STRIPE_PRICE_PRO_ANNUAL: "price_pro_a",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    ...overrides,
  });
}

describe("resolveCommercialMode", () => {
  it("defaults to demo outside production when unset", () => {
    expect(resolveCommercialMode(env({ NODE_ENV: "development" }))).toBe("demo");
    expect(resolveCommercialMode(env({ NODE_ENV: "test" }))).toBe("demo");
  });

  it("defaults to disabled in production when unset", () => {
    expect(resolveCommercialMode(env({ NODE_ENV: "production" }))).toBe(
      "disabled"
    );
  });

  it("honors explicit COMMERCIAL_MODE", () => {
    expect(
      resolveCommercialMode(
        env({ NODE_ENV: "production", COMMERCIAL_MODE: "live" })
      )
    ).toBe("live");
    expect(
      resolveCommercialMode(
        env({ NODE_ENV: "development", COMMERCIAL_MODE: "disabled" })
      )
    ).toBe("disabled");
    expect(
      resolveCommercialMode(
        env({ NODE_ENV: "production", COMMERCIAL_MODE: "demo" })
      )
    ).toBe("demo");
  });
});

describe("Stripe payments require live mode", () => {
  it("never enables payments in disabled mode even with Stripe keys", () => {
    const e = liveReadyEnv({ COMMERCIAL_MODE: "disabled" });
    expect(isStripePaymentsEnabled(e)).toBe(false);
    expect(assertCheckoutAllowed(e)).toMatchObject({
      ok: false,
      code: "commercial_disabled",
      status: 403,
    });
    expect(assertPortalAllowed(e)).toMatchObject({
      ok: false,
      code: "commercial_disabled",
      status: 403,
    });
  });

  it("never enables payments in demo mode even with Stripe keys", () => {
    const e = liveReadyEnv({
      NODE_ENV: "development",
      COMMERCIAL_MODE: "demo",
    });
    expect(isStripePaymentsEnabled(e)).toBe(false);
    const checkout = assertCheckoutAllowed(e);
    expect(checkout.ok).toBe(false);
    if (!checkout.ok) {
      expect(checkout.code).toBe("commercial_demo");
      expect(checkout.status).toBe(403);
      expect(checkout.error).toMatch(/Demo mode cannot create Stripe/i);
    }
    expect(assertPortalAllowed(e)).toMatchObject({
      ok: false,
      code: "commercial_demo",
      status: 403,
    });
  });

  it("does not enable payments when live but Stripe secret is missing", () => {
    const liveNoKey = env({
      NODE_ENV: "production",
      COMMERCIAL_MODE: "live",
    });
    expect(isStripePaymentsEnabled(liveNoKey)).toBe(false);
    expect(assertCheckoutAllowed(liveNoKey)).toMatchObject({
      ok: false,
      code: "stripe_not_configured",
      status: 503,
    });
  });

  it("does not enable payments when live secret exists but config is incomplete", () => {
    const livePartial = env({
      NODE_ENV: "production",
      COMMERCIAL_MODE: "live",
      STRIPE_SECRET_KEY: stripeKey,
    });
    expect(isStripePaymentsEnabled(livePartial)).toBe(false);
    expect(assertCheckoutAllowed(livePartial)).toMatchObject({
      ok: false,
      code: "live_not_ready",
      status: 503,
    });
  });

  it("enables payments only when live and readiness config is complete", () => {
    const liveReady = liveReadyEnv();
    expect(isStripePaymentsEnabled(liveReady)).toBe(true);
    expect(assertCheckoutAllowed(liveReady)).toEqual({ ok: true });
    expect(assertPortalAllowed(liveReady)).toEqual({ ok: true });
  });
});

describe("commercial capabilities", () => {
  it("exposes checkout/portal off and optional dev top-up in demo", () => {
    const caps = getCommercialCapabilities(
      env({ NODE_ENV: "development", COMMERCIAL_MODE: "demo" })
    );
    expect(caps.mode).toBe("demo");
    expect(caps.checkoutEnabled).toBe(false);
    expect(caps.portalEnabled).toBe(false);
    expect(caps.foundingOfferCheckoutEnabled).toBe(false);
    expect(caps.liveConfigReady).toBe(false);
    expect(caps.devTopupAllowed).toBe(true);
  });

  it("hides commercial actions in disabled mode", () => {
    const caps = getCommercialCapabilities(
      env({ NODE_ENV: "development", COMMERCIAL_MODE: "disabled" })
    );
    expect(caps.checkoutEnabled).toBe(false);
    expect(caps.portalEnabled).toBe(false);
    expect(caps.devTopupAllowed).toBe(false);
  });

  it("allows checkout in live with full readiness and blocks dev top-up", () => {
    const caps = getCommercialCapabilities(
      liveReadyEnv({ NODE_ENV: "development" })
    );
    expect(caps.checkoutEnabled).toBe(true);
    expect(caps.portalEnabled).toBe(true);
    expect(caps.devTopupAllowed).toBe(false);
    expect(
      isDevTopupAllowed(liveReadyEnv({ NODE_ENV: "development" }))
    ).toBe(false);
  });
});

describe("feature flags for unfinished features", () => {
  it("defaults unfinished flags to off", () => {
    expect(getFeatureFlags(env({}))).toEqual({
      voice: false,
      autoTopup: false,
      spendCapEnforcement: false,
      workspaceBudgets: false,
      dailyFairUseCredits: false,
      creditPackStorefront: false,
    });
  });

  it("allows FEATURE_* overrides", () => {
    const flags = getFeatureFlags(
      env({
        FEATURE_VOICE: "1",
        FEATURE_AUTO_TOPUP: "true",
        FEATURE_CREDIT_PACK_STOREFRONT: "off",
      })
    );
    expect(flags.voice).toBe(true);
    expect(flags.autoTopup).toBe(true);
    expect(flags.creditPackStorefront).toBe(false);
  });
});

describe("checkout gate never creates sessions outside live", () => {
  afterEach(() => {
    /* pure functions — no globals */
  });

  it("blocks demo and disabled before any Stripe client call would run", () => {
    for (const mode of ["demo", "disabled"] as const) {
      const result = assertCheckoutAllowed(
        liveReadyEnv({
          NODE_ENV: "development",
          COMMERCIAL_MODE: mode,
        })
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(["commercial_demo", "commercial_disabled"]).toContain(result.code);
      }
    }
  });
});
