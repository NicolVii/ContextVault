import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  subscriptionSnapshotFromStripe,
  subscriptionRowsDiffer,
} from "../src/lib/billing/subscription-sync";
import { countsAsPaidRevenue, resolveEffectiveEntitlement } from "../src/lib/billing/entitlement-resolution";

/**
 * Pure webhook / sync helpers that do not require Supabase.
 * Full claim + handler paths are covered by production-safety + integration.
 */

function fakeSub(
  partial: Partial<Stripe.Subscription> & {
    id: string;
    status: Stripe.Subscription.Status;
    priceId: string;
  }
): Stripe.Subscription {
  return {
    id: partial.id,
    object: "subscription",
    status: partial.status,
    cancel_at_period_end: partial.cancel_at_period_end ?? false,
    customer: partial.customer ?? "cus_test",
    metadata: partial.metadata ?? { cortaix_user_id: "user_1", plan_id: "pro" },
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          price: { id: partial.priceId, object: "price" } as Stripe.Price,
          current_period_end: 1_785_000_000,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: "",
    },
    current_period_end: 1_785_000_000,
  } as unknown as Stripe.Subscription;
}

describe("subscriptionSnapshotFromStripe", () => {
  it("maps Stripe subscription fields into a local sync row", () => {
    // Price env mapping is empty in unit tests → plan falls back to metadata.
    const snap = subscriptionSnapshotFromStripe(
      "user_1",
      fakeSub({
        id: "sub_abc",
        status: "active",
        priceId: "price_unknown",
        cancel_at_period_end: true,
        metadata: { cortaix_user_id: "user_1", plan_id: "lite" },
      })
    );
    expect(snap).toMatchObject({
      userId: "user_1",
      stripeSubscriptionId: "sub_abc",
      stripePriceId: "price_unknown",
      planId: "lite",
      status: "active",
      cancelAtPeriodEnd: true,
    });
    expect(snap.currentPeriodEnd).toBeTruthy();
  });

  it("never promotes legacy team plan ids", () => {
    const snap = subscriptionSnapshotFromStripe(
      "user_1",
      fakeSub({
        id: "sub_team",
        status: "active",
        priceId: "price_x",
        metadata: { plan_id: "team" },
      })
    );
    expect(snap.planId).toBe("free");
  });
});

describe("admin grants vs Stripe financial truth", () => {
  it("admin grants never count as paid revenue even on Pro", () => {
    const resolved = resolveEffectiveEntitlement({
      now: new Date("2026-07-22T12:00:00.000Z"),
      grants: [
        {
          id: "grant_1",
          planId: "pro",
          startsAt: "2026-07-01T00:00:00.000Z",
          endsAt: "2026-08-01T00:00:00.000Z",
          autoTurnBonus: 0,
          frontierTurnBonus: 0,
          creditBonus: 0,
          storageBytesOverride: null,
          featureOverrides: {},
          reason: "support extension",
          createdBy: "admin",
          revokedAt: null,
          excludeFromRevenue: true,
        },
      ],
      subscription: {
        planId: "lite",
        status: "active",
        currentPeriodEnd: "2026-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    });
    expect(resolved.source).toBe("admin_grant");
    expect(resolved.isDemo).toBe(true);
    expect(resolved.excludeFromRevenue).toBe(true);
    expect(countsAsPaidRevenue(resolved)).toBe(false);
    // Underlying Stripe subscription is preserved as financial truth separately;
    // entitlement overlay must not rewrite plan_id on the subscription row.
    expect(resolved.planId).toBe("pro");
  });

  it("real Stripe subscription still counts as paid revenue without grants", () => {
    const resolved = resolveEffectiveEntitlement({
      subscription: {
        planId: "pro",
        status: "active",
        currentPeriodEnd: "2026-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    });
    expect(resolved.source).toBe("subscription");
    expect(countsAsPaidRevenue(resolved)).toBe(true);
  });

  it("past_due Stripe status still entitles during grace", () => {
    const resolved = resolveEffectiveEntitlement({
      subscription: {
        planId: "lite",
        status: "past_due",
        currentPeriodEnd: "2026-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    });
    expect(resolved.source).toBe("subscription");
    expect(resolved.planId).toBe("lite");
    expect(countsAsPaidRevenue(resolved)).toBe(true);
  });
});

describe("subscription drift detection", () => {
  it("treats cancel_at_period_end flips as drift", () => {
    const desired = subscriptionSnapshotFromStripe(
      "user_1",
      fakeSub({
        id: "sub_1",
        status: "active",
        priceId: "price_1",
        cancel_at_period_end: true,
        metadata: { plan_id: "pro" },
      })
    );
    expect(
      subscriptionRowsDiffer(
        {
          stripe_subscription_id: "sub_1",
          stripe_price_id: "price_1",
          plan_id: "pro",
          status: "active",
          current_period_end: desired.currentPeriodEnd,
          cancel_at_period_end: false,
        },
        desired
      )
    ).toBe(true);
  });
});
