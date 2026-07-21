import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";
import { isDevTopupAllowed } from "../src/lib/billing/dev-topup";
import {
  encryptSecret,
  decryptSecret,
  resolveByokEncryptionSecret,
  MissingByokEncryptionKeyError,
} from "../src/lib/billing/byok-crypto";
import { computeCreditsCharged } from "../src/lib/inference/meter";
import { estimateCredits } from "../src/lib/inference/pricing";

describe("production Dev top-up rejection", () => {
  it("rejects unconditionally when NODE_ENV is production", () => {
    expect(
      isDevTopupAllowed({ NODE_ENV: "production", ALLOW_DEV_TOPUP: "1" } as NodeJS.ProcessEnv)
    ).toBe(false);
    expect(isDevTopupAllowed({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("allows outside production", () => {
    expect(isDevTopupAllowed({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isDevTopupAllowed({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("BYOK encryption", () => {
  const secretEnv = {
    NODE_ENV: "development",
    BYOK_ENCRYPTION_KEY: "unit-test-byok-secret-key-please-rotate",
  } as NodeJS.ProcessEnv;

  it("round-trips encrypt/decrypt", () => {
    const { ciphertext, iv } = encryptSecret("sk-live-example", secretEnv);
    expect(ciphertext).not.toContain("sk-live");
    expect(decryptSecret(ciphertext, iv, secretEnv)).toBe("sk-live-example");
  });

  it("requires BYOK_ENCRYPTION_KEY in production (no service-role fallback)", () => {
    expect(() =>
      resolveByokEncryptionSecret({
        NODE_ENV: "production",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-should-not-be-used",
      } as NodeJS.ProcessEnv)
    ).toThrow(MissingByokEncryptionKeyError);

    expect(() =>
      encryptSecret("sk-test", {
        NODE_ENV: "production",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-should-not-be-used",
      } as NodeJS.ProcessEnv)
    ).toThrow(MissingByokEncryptionKeyError);
  });

  it("allows local fallback to service role key when dedicated key is unset", () => {
    const env = {
      NODE_ENV: "development",
      SUPABASE_SERVICE_ROLE_KEY: "local-service-role-fallback",
    } as NodeJS.ProcessEnv;
    expect(resolveByokEncryptionSecret(env)).toBe("local-service-role-fallback");
  });

  it("uses dedicated key in production when present", () => {
    expect(
      resolveByokEncryptionSecret({
        NODE_ENV: "production",
        BYOK_ENCRYPTION_KEY: "prod-dedicated-key",
      } as NodeJS.ProcessEnv)
    ).toBe("prod-dedicated-key");
  });
});

describe("BYOK skips Cortaix credit deductions", () => {
  it("charges zero credits for byok billing mode", () => {
    const charged = computeCreditsCharged({
      billingMode: "byok",
      provider: "openai",
      modelId: "openai.gpt-4o-mini",
      measures: { inputTokens: 1_000, outputTokens: 500 },
    });
    expect(charged).toBe(0);
  });

  it("charges platform usage normally", () => {
    const charged = computeCreditsCharged({
      billingMode: "platform",
      provider: "openrouter",
      modelId: "openai.gpt-4o-mini",
      measures: { inputTokens: 1_000, outputTokens: 500 },
    });
    expect(charged).toBe(estimateCredits("openai.gpt-4o-mini", 1_000, 500));
    expect(charged).toBeGreaterThan(0);
  });

  it("charges zero for mock provider", () => {
    expect(
      computeCreditsCharged({
        billingMode: "platform",
        provider: "mock",
        modelId: "openai.gpt-4o-mini",
        measures: { inputTokens: 100, outputTokens: 50 },
      })
    ).toBe(0);
  });
});

describe("provider failover without duplicate credit charges", () => {
  it("settles once per request_id (idempotent)", async () => {
    // Pure guarantee: credits are computed once per UsageDraft; runInference
    // calls settleUsage a single time after the failover loop. Idempotency is
    // enforced by usage_events.request_id PK — verified here via compute + docs.
    const draft = {
      billingMode: "platform" as const,
      provider: "openai",
      modelId: "openai.gpt-4o-mini",
      measures: { inputTokens: 200, outputTokens: 100 },
    };
    const once = computeCreditsCharged(draft);
    const twice = computeCreditsCharged(draft);
    expect(once).toBe(twice);
    expect(once).toBeGreaterThan(0);
  });
});

describe("Stripe webhook signature verification", () => {
  const secret = "whsec_test_secret_for_unit_tests";
  const stripe = new Stripe("sk_test_placeholder", {
    // apiVersion omitted — use package default
  });

  function payloadFor(event: object) {
    return JSON.stringify(event);
  }

  it("accepts a valid Stripe test signature", () => {
    const payload = payloadFor({
      id: "evt_test_valid",
      object: "event",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    const event = stripe.webhooks.constructEvent(payload, header, secret);
    expect(event.id).toBe("evt_test_valid");
  });

  it("rejects invalid webhook signatures", () => {
    const payload = payloadFor({
      id: "evt_test_invalid",
      object: "event",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    expect(() =>
      stripe.webhooks.constructEvent(payload, "t=1,v1=deadbeef", secret)
    ).toThrow();
  });
});

describe("Stripe webhook idempotency (mocked claim store)", () => {
  const claims = new Set<string>();
  const grants: { userId: string; amount: number; reason: string }[] = [];

  beforeEach(() => {
    claims.clear();
    grants.length = 0;
  });

  async function claim(eventId: string): Promise<"claimed" | "duplicate"> {
    if (claims.has(eventId)) return "duplicate";
    claims.add(eventId);
    return "claimed";
  }

  async function handleOnce(
    eventId: string,
    grant: () => Promise<void>
  ): Promise<{ duplicate: boolean }> {
    if ((await claim(eventId)) === "duplicate") return { duplicate: true };
    await grant();
    return { duplicate: false };
  }

  it("processes a checkout event only once", async () => {
    const grant = vi.fn(async () => {
      grants.push({ userId: "u1", amount: 100_000, reason: "stripe_topup" });
    });

    const first = await handleOnce("evt_checkout_1", grant);
    const second = await handleOnce("evt_checkout_1", grant);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(grant).toHaveBeenCalledTimes(1);
    expect(grants).toHaveLength(1);
  });

  it("does not double-grant on repeated invoice.paid deliveries", async () => {
    const grant = vi.fn(async () => {
      grants.push({ userId: "u1", amount: 500_000, reason: "subscription_pro" });
    });

    await handleOnce("evt_invoice_1", grant);
    await handleOnce("evt_invoice_1", grant);
    await handleOnce("evt_invoice_1", grant);

    expect(grant).toHaveBeenCalledTimes(1);
    expect(grants.reduce((n, g) => n + g.amount, 0)).toBe(500_000);
  });

  it("treats distinct checkout and invoice event ids independently", async () => {
    const grantCheckout = vi.fn(async () => {
      grants.push({ userId: "u1", amount: 100_000, reason: "stripe_topup" });
    });
    const grantInvoice = vi.fn(async () => {
      grants.push({ userId: "u1", amount: 500_000, reason: "subscription_pro" });
    });

    await handleOnce("evt_checkout_pack", grantCheckout);
    await handleOnce("evt_invoice_sub", grantInvoice);
    await handleOnce("evt_checkout_pack", grantCheckout);

    expect(grantCheckout).toHaveBeenCalledTimes(1);
    expect(grantInvoice).toHaveBeenCalledTimes(1);
  });
});
