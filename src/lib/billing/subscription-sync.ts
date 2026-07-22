/**
 * Stripe → Postgres subscription sync helpers.
 *
 * Stripe remains the financial source of truth for paid subscriptions.
 * Admin entitlement grants must never call these helpers to rewrite
 * stripe_subscription_id / stripe_price_id / paid plan history.
 */

import type Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { planForStripePrice } from "./products";
import { recordBillingTelemetry } from "./telemetry";

export type SyncedSubscriptionRow = {
  userId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  planId: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

function periodEndIso(sub: Stripe.Subscription): string | null {
  const periodEnd =
    (sub as Stripe.Subscription & { current_period_end?: number })
      .current_period_end ?? sub.items.data[0]?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}

export function subscriptionSnapshotFromStripe(
  userId: string,
  sub: Stripe.Subscription
): SyncedSubscriptionRow {
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const plan = priceId ? planForStripePrice(priceId) : null;
  const planId =
    plan?.id ?? (sub.metadata?.plan_id as string | undefined) ?? "free";

  return {
    userId,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    planId: planId === "team" ? "free" : planId,
    status: sub.status,
    currentPeriodEnd: periodEndIso(sub),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  };
}

/** Upsert a Stripe subscription into local `subscriptions` (Stripe wins). */
export async function upsertSubscriptionFromStripe(
  userId: string,
  sub: Stripe.Subscription
): Promise<SyncedSubscriptionRow> {
  const snap = subscriptionSnapshotFromStripe(userId, sub);
  const admin = createSupabaseAdminClient();
  await admin.from("subscriptions").upsert(
    {
      user_id: snap.userId,
      stripe_subscription_id: snap.stripeSubscriptionId,
      stripe_price_id: snap.stripePriceId,
      plan_id: snap.planId,
      status: snap.status,
      current_period_end: snap.currentPeriodEnd,
      cancel_at_period_end: snap.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  return snap;
}

/** Mark local subscription canceled / Free after Stripe deletion. */
export async function markSubscriptionCanceledLocally(
  userId: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      plan_id: "free",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  await recordBillingTelemetry({
    userId,
    eventName: "subscription_canceled",
    planId: "free",
  });
}

export function subscriptionRowsDiffer(
  local: {
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    plan_id: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  },
  desired: SyncedSubscriptionRow
): boolean {
  const localEnd = local.current_period_end
    ? new Date(local.current_period_end).toISOString()
    : null;
  const desiredEnd = desired.currentPeriodEnd
    ? new Date(desired.currentPeriodEnd).toISOString()
    : null;
  return (
    (local.stripe_subscription_id ?? null) !== desired.stripeSubscriptionId ||
    (local.stripe_price_id ?? null) !== desired.stripePriceId ||
    local.plan_id !== desired.planId ||
    local.status !== desired.status ||
    localEnd !== desiredEnd ||
    Boolean(local.cancel_at_period_end) !== desired.cancelAtPeriodEnd
  );
}
