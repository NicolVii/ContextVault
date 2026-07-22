/**
 * Stripe lifecycle hardening (integration): payment_failed → grace,
 * grace expiry → inference_restricted, subscription.deleted → Free,
 * invoice.paid clears restriction. Uses dispatchStripeEventForTests —
 * no live Stripe HTTP.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";
import { assertIntegrationEnv } from "./setup-env";
import { ensureFreeSubscription } from "../src/lib/billing/ensure-free";
import {
  dispatchStripeEventForTests,
  applyGraceExpiryIfNeeded,
} from "../src/lib/billing/webhook";
import { getPlanUsageSnapshot } from "../src/lib/billing/plan-usage";
import { evaluatePlanTurnGate } from "../src/lib/billing/plan-usage";

let user: TestUser;
const stripeCustomerId = `cus_hardening_${Date.now()}`;

function stripeEvent(
  type: Stripe.Event.Type,
  object: object,
  idSuffix: string
): Stripe.Event {
  return {
    id: `evt_hardening_${idSuffix}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    object: "event",
    api_version: "2024-11-20.acacia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
    data: { object },
  } as Stripe.Event;
}

beforeAll(async () => {
  assertIntegrationEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`health status ${res.status}`);
  } catch (err) {
    throw new Error(
      [
        `Supabase is not reachable at ${url}.`,
        "Start the local stack with `pnpm db:start` (Docker required), then re-run.",
        `Cause: ${err instanceof Error ? err.message : String(err)}`,
      ].join("\n")
    );
  }

  user = await createTestUser();
  await ensureFreeSubscription(user.id);

  const admin = adminClient();
  await admin.from("stripe_customers").upsert({
    user_id: user.id,
    stripe_customer_id: stripeCustomerId,
  });
  await admin.from("billing_settings").upsert(
    { user_id: user.id },
    { onConflict: "user_id", ignoreDuplicates: true }
  );
});

afterAll(async () => {
  if (user) await deleteTestUser(user.id).catch(() => {});
});

describe("Stripe payment failure and grace", () => {
  it("starts a 7-day grace window on invoice.payment_failed", async () => {
    const before = Date.now();
    await dispatchStripeEventForTests(
      stripeEvent(
        "invoice.payment_failed",
        {
          id: `in_fail_${Date.now()}`,
          object: "invoice",
          customer: stripeCustomerId,
          attempt_count: 1,
          metadata: { cortaix_user_id: user.id },
        },
        "pay_fail"
      )
    );

    const admin = adminClient();
    const { data } = await admin
      .from("billing_settings")
      .select("grace_period_ends_at, inference_restricted")
      .eq("user_id", user.id)
      .single();

    expect(data?.inference_restricted).toBe(false);
    expect(data?.grace_period_ends_at).toBeTruthy();
    const ends = new Date(data!.grace_period_ends_at as string).getTime();
    const sixDays = 6 * 24 * 60 * 60 * 1000;
    const eightDays = 8 * 24 * 60 * 60 * 1000;
    expect(ends - before).toBeGreaterThan(sixDays);
    expect(ends - before).toBeLessThan(eightDays);

    const { data: telemetry } = await admin
      .from("billing_telemetry_events")
      .select("event_name")
      .eq("user_id", user.id)
      .eq("event_name", "payment_failed")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(telemetry?.[0]?.event_name).toBe("payment_failed");
  });

  it("does not shorten an existing active grace window on repeat failure", async () => {
    const admin = adminClient();
    const farFuture = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000
    ).toISOString();
    await admin
      .from("billing_settings")
      .update({
        grace_period_ends_at: farFuture,
        inference_restricted: false,
      })
      .eq("user_id", user.id);

    await dispatchStripeEventForTests(
      stripeEvent(
        "invoice.payment_failed",
        {
          id: `in_fail2_${Date.now()}`,
          object: "invoice",
          customer: stripeCustomerId,
          attempt_count: 2,
          metadata: { cortaix_user_id: user.id },
        },
        "pay_fail2"
      )
    );

    const { data } = await admin
      .from("billing_settings")
      .select("grace_period_ends_at")
      .eq("user_id", user.id)
      .single();
    expect(new Date(data!.grace_period_ends_at as string).toISOString()).toBe(
      farFuture
    );
  });

  it("applies inference_restricted when grace has expired", async () => {
    const admin = adminClient();
    const past = new Date(Date.now() - 60_000).toISOString();
    await admin
      .from("billing_settings")
      .update({
        grace_period_ends_at: past,
        inference_restricted: false,
      })
      .eq("user_id", user.id);

    const restricted = await applyGraceExpiryIfNeeded(user.id);
    expect(restricted).toBe(true);

    const { data } = await admin
      .from("billing_settings")
      .select("inference_restricted")
      .eq("user_id", user.id)
      .single();
    expect(data?.inference_restricted).toBe(true);

    const snap = await getPlanUsageSnapshot(user.id);
    expect(snap.inferenceRestricted).toBe(true);
    expect(() =>
      evaluatePlanTurnGate({
        inferenceRestricted: snap.inferenceRestricted,
        entitlements: snap.entitlements,
        autoRemaining: snap.autoRemaining,
        frontierRemaining: snap.frontierRemaining,
        autoCredits: snap.autoCredits,
        frontierCredits: snap.frontierCredits,
        intensity: "auto",
        estimatedCredits: 10,
      })
    ).toThrow(/paused due to a billing problem/i);

    const { data: telemetry } = await admin
      .from("billing_telemetry_events")
      .select("event_name, meta")
      .eq("user_id", user.id)
      .eq("event_name", "inference_restricted")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(telemetry?.[0]?.event_name).toBe("inference_restricted");
  });

  it("clears restriction on invoice.paid", async () => {
    await dispatchStripeEventForTests(
      stripeEvent(
        "invoice.paid",
        {
          id: `in_paid_${Date.now()}`,
          object: "invoice",
          customer: stripeCustomerId,
          metadata: { cortaix_user_id: user.id },
          lines: { data: [] },
        },
        "paid"
      )
    );

    const admin = adminClient();
    const { data } = await admin
      .from("billing_settings")
      .select("inference_restricted, grace_period_ends_at")
      .eq("user_id", user.id)
      .single();
    expect(data?.inference_restricted).toBe(false);
    expect(data?.grace_period_ends_at).toBeNull();
  });
});

describe("Stripe subscription cancellation", () => {
  it("marks local subscription Free after customer.subscription.deleted", async () => {
    const admin = adminClient();
    await admin.from("subscriptions").upsert({
      user_id: user.id,
      plan_id: "pro",
      status: "active",
      stripe_subscription_id: `sub_hardening_${user.id.slice(0, 8)}`,
      stripe_price_id: "price_pro_m",
      current_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      cancel_at_period_end: false,
    });

    await dispatchStripeEventForTests(
      stripeEvent(
        "customer.subscription.deleted",
        {
          id: `sub_hardening_${user.id.slice(0, 8)}`,
          object: "subscription",
          customer: stripeCustomerId,
          status: "canceled",
          cancel_at_period_end: false,
          metadata: { cortaix_user_id: user.id, plan_id: "pro" },
          items: { data: [] },
        },
        "sub_del"
      )
    );

    const { data } = await admin
      .from("subscriptions")
      .select("plan_id, status")
      .eq("user_id", user.id)
      .single();
    expect(data?.plan_id).toBe("free");
    expect(data?.status).toBe("canceled");

    const snap = await getPlanUsageSnapshot(user.id);
    // After cancel, effective entitlement falls back to Free (or free source).
    expect(snap.planId).toBe("free");

    const { data: telemetry } = await admin
      .from("billing_telemetry_events")
      .select("event_name")
      .eq("user_id", user.id)
      .eq("event_name", "subscription_canceled")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(telemetry?.[0]?.event_name).toBe("subscription_canceled");
  });
});

describe("plan simulation and temporary grants (lifecycle companion)", () => {
  it("keeps Free plan limits after cancel (no Frontier)", async () => {
    const snap = await getPlanUsageSnapshot(user.id);
    expect(snap.entitlements.frontierMonthlyTurns).toBe(0);
    expect(snap.entitlements.attachments).toBe(false);
  });
});
