/**
 * Stripe ↔ local subscription reconciliation.
 *
 * Stripe is the financial source of truth for real paid subscriptions.
 * This module repairs local `subscriptions` drift (missed webhooks, stale
 * portal changes) without touching admin entitlement grants or rewriting
 * Stripe itself.
 */

import type Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./stripe";
import { isStripePaymentsEnabled } from "./commercial";
import { recordBillingTelemetry } from "./telemetry";
import {
  markSubscriptionCanceledLocally,
  subscriptionRowsDiffer,
  subscriptionSnapshotFromStripe,
  upsertSubscriptionFromStripe,
  type SyncedSubscriptionRow,
} from "./subscription-sync";

export type ReconcileUserResult = {
  userId: string;
  stripeCustomerId: string | null;
  action:
    | "unchanged"
    | "updated"
    | "canceled_local"
    | "no_stripe_customer"
    | "no_stripe_subscription"
    | "skipped";
  before: SyncedSubscriptionRow | null;
  after: SyncedSubscriptionRow | null;
  drift: boolean;
};

export type ReconcileBatchResult = {
  scanned: number;
  updated: number;
  canceled: number;
  unchanged: number;
  skipped: number;
  results: ReconcileUserResult[];
};

function pickPrimarySubscription(
  subs: Stripe.Subscription[]
): Stripe.Subscription | null {
  const rank = (status: string): number => {
    switch (status) {
      case "active":
        return 0;
      case "trialing":
        return 1;
      case "past_due":
        return 2;
      case "unpaid":
        return 3;
      case "incomplete":
        return 4;
      default:
        return 9;
    }
  };
  const sorted = [...subs].sort((a, b) => rank(a.status) - rank(b.status));
  return sorted[0] ?? null;
}

async function loadLocalSubscription(userId: string): Promise<{
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select(
      "stripe_subscription_id, stripe_price_id, plan_id, status, current_period_end, cancel_at_period_end"
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (data as {
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    plan_id: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null) ?? null;
}

/**
 * Reconcile one user's local subscription row from Stripe.
 * Does not modify admin_entitlement_grants or financial ledger history.
 */
export async function reconcileUserSubscription(
  userId: string
): Promise<ReconcileUserResult> {
  if (!isStripePaymentsEnabled()) {
    return {
      userId,
      stripeCustomerId: null,
      action: "skipped",
      before: null,
      after: null,
      drift: false,
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    return {
      userId,
      stripeCustomerId: null,
      action: "skipped",
      before: null,
      after: null,
      drift: false,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: customer } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const stripeCustomerId =
    (customer?.stripe_customer_id as string | undefined) ?? null;
  const local = await loadLocalSubscription(userId);
  const before: SyncedSubscriptionRow | null = local
    ? {
        userId,
        stripeSubscriptionId: local.stripe_subscription_id,
        stripePriceId: local.stripe_price_id,
        planId: local.plan_id,
        status: local.status,
        currentPeriodEnd: local.current_period_end,
        cancelAtPeriodEnd: local.cancel_at_period_end,
      }
    : null;

  if (!stripeCustomerId) {
    return {
      userId,
      stripeCustomerId: null,
      action: "no_stripe_customer",
      before,
      after: before,
      drift: false,
    };
  }

  const listed = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 20,
  });

  const primary = pickPrimarySubscription(
    listed.data.filter((s) =>
      ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(
        s.status
      )
    )
  );

  if (!primary) {
    // No open Stripe subscription — if local still looks paid, demote to Free.
    const looksPaid =
      local &&
      local.stripe_subscription_id &&
      ["active", "trialing", "past_due", "unpaid"].includes(local.status);

    if (looksPaid) {
      await markSubscriptionCanceledLocally(userId);
      const after: SyncedSubscriptionRow = {
        userId,
        stripeSubscriptionId: local!.stripe_subscription_id,
        stripePriceId: local!.stripe_price_id,
        planId: "free",
        status: "canceled",
        currentPeriodEnd: local!.current_period_end,
        cancelAtPeriodEnd: local!.cancel_at_period_end,
      };
      await recordBillingTelemetry({
        userId,
        eventName: "subscription_reconciled",
        planId: "free",
        meta: { action: "canceled_local", stripeCustomerId },
      });
      return {
        userId,
        stripeCustomerId,
        action: "canceled_local",
        before,
        after,
        drift: true,
      };
    }

    return {
      userId,
      stripeCustomerId,
      action: "no_stripe_subscription",
      before,
      after: before,
      drift: false,
    };
  }

  const desired = subscriptionSnapshotFromStripe(userId, primary);
  const drift = !local || subscriptionRowsDiffer(local, desired);

  if (!drift) {
    return {
      userId,
      stripeCustomerId,
      action: "unchanged",
      before,
      after: desired,
      drift: false,
    };
  }

  const after = await upsertSubscriptionFromStripe(userId, primary);
  await recordBillingTelemetry({
    userId,
    eventName: "subscription_reconciled",
    planId: after.planId,
    meta: {
      action: "updated",
      stripeCustomerId,
      stripeSubscriptionId: after.stripeSubscriptionId,
      status: after.status,
    },
  });

  return {
    userId,
    stripeCustomerId,
    action: "updated",
    before,
    after,
    drift: true,
  };
}

/**
 * Reconcile all mapped Stripe customers (bounded batch).
 * Prefer calling from an admin/ops path — not on every request.
 */
export async function reconcileAllSubscriptions(opts?: {
  limit?: number;
}): Promise<ReconcileBatchResult> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("stripe_customers")
    .select("user_id")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const results: ReconcileUserResult[] = [];
  let updated = 0;
  let canceled = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const result = await reconcileUserSubscription(userId);
    results.push(result);
    switch (result.action) {
      case "updated":
        updated += 1;
        break;
      case "canceled_local":
        canceled += 1;
        break;
      case "unchanged":
      case "no_stripe_customer":
      case "no_stripe_subscription":
        unchanged += 1;
        break;
      default:
        skipped += 1;
        break;
    }
  }

  await recordBillingTelemetry({
    eventName: "subscription_reconcile_batch",
    meta: {
      scanned: results.length,
      updated,
      canceled,
      unchanged,
      skipped,
    },
  });

  return {
    scanned: results.length,
    updated,
    canceled,
    unchanged,
    skipped,
    results,
  };
}
