import type Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { grantCredits } from "@/lib/inference/credits";
import {
  packCreditsForStripePrice,
  planForStripePrice,
} from "./products";
import { entitlementsForPlan } from "./entitlements";
import { recordBillingTelemetry } from "./telemetry";
import { ensurePlanConfigLoaded } from "./plan-config-loader";
import { getStripe } from "./stripe";
import {
  markSubscriptionCanceledLocally,
  upsertSubscriptionFromStripe,
} from "./subscription-sync";

const GRACE_DAYS = 7;

async function resolveUserId(opts: {
  stripeCustomerId?: string | null;
  metadataUserId?: string | null;
}): Promise<string | null> {
  if (opts.metadataUserId) return opts.metadataUserId;
  if (!opts.stripeCustomerId) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", opts.stripeCustomerId)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

/**
 * Persist Stripe event id with a unique constraint.
 * Returns "claimed" on first sight, "duplicate" if already processed.
 * This is the replay-protection / idempotency gate for all webhook handlers.
 */
export async function claimStripeEvent(
  eventId: string,
  eventType: string
): Promise<"claimed" | "duplicate"> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("stripe_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
  });
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw error;
  }
  return "claimed";
}

async function releaseStripeEventClaim(eventId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("stripe_webhook_events").delete().eq("event_id", eventId);
}

export type HandleStripeEventResult = {
  duplicate: boolean;
  processed: boolean;
};

/**
 * Verify callers have already authenticated the Stripe signature.
 * This entry point enforces replay protection then dispatches.
 */
export async function handleStripeEvent(
  event: Stripe.Event
): Promise<HandleStripeEventResult> {
  const claim = await claimStripeEvent(event.id, event.type);
  if (claim === "duplicate") {
    await recordBillingTelemetry({
      eventName: "webhook_replay_ignored",
      meta: { eventId: event.id, eventType: event.type },
    });
    return { duplicate: true, processed: false };
  }

  try {
    assertEventLivemodeConsistent(event);
    await dispatchStripeEvent(event);
    await recordBillingTelemetry({
      eventName: "webhook_processed",
      meta: {
        eventId: event.id,
        eventType: event.type,
        livemode: event.livemode,
      },
    });
    return { duplicate: false, processed: true };
  } catch (err) {
    await releaseStripeEventClaim(event.id);
    throw err;
  }
}

/**
 * Reject mixed-mode deliveries (e.g. livemode event against sk_test_*).
 * Signature verification already binds the payload to the webhook secret;
 * this is an extra guard against misconfigured forwarding.
 */
function assertEventLivemodeConsistent(event: Stripe.Event): void {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) return;
  if (event.livemode && key.startsWith("sk_test_")) {
    throw new Error(
      `Stripe livemode event ${event.id} rejected against sk_test_* secret`
    );
  }
  if (!event.livemode && key.startsWith("sk_live_")) {
    throw new Error(
      `Stripe test-mode event ${event.id} rejected against sk_live_* secret`
    );
  }
}

async function dispatchStripeEvent(event: Stripe.Event): Promise<void> {
  await ensurePlanConfigLoaded();
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "invoice.paid":
      await onInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    case "charge.refunded":
      await onChargeRefunded(event.data.object as Stripe.Charge);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.created":
      await onSubscriptionUpserted(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }
}

/** Test/helper export for unit coverage of grant paths without claim wrapping. */
export async function dispatchStripeEventForTests(
  event: Stripe.Event
): Promise<void> {
  await dispatchStripeEvent(event);
}

async function ensureBillingSettings(userId: string) {
  const admin = createSupabaseAdminClient();
  await admin.from("billing_settings").upsert(
    { user_id: userId },
    { onConflict: "user_id", ignoreDuplicates: true }
  );
}

async function clearInferenceRestriction(userId: string) {
  await ensureBillingSettings(userId);
  const admin = createSupabaseAdminClient();
  await admin
    .from("billing_settings")
    .update({
      inference_restricted: false,
      grace_period_ends_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function startPaymentGrace(userId: string) {
  await ensureBillingSettings(userId);
  const admin = createSupabaseAdminClient();
  const ends = new Date();
  ends.setUTCDate(ends.getUTCDate() + GRACE_DAYS);
  const { data } = await admin
    .from("billing_settings")
    .select("grace_period_ends_at, inference_restricted")
    .eq("user_id", userId)
    .maybeSingle();

  // Do not shorten an existing grace window.
  if (data?.grace_period_ends_at && !data.inference_restricted) {
    const existing = new Date(data.grace_period_ends_at as string);
    if (existing > new Date()) return;
  }

  await admin
    .from("billing_settings")
    .update({
      grace_period_ends_at: ends.toISOString(),
      inference_restricted: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

/** Re-export for callers that import grace helpers from webhook. */
export { applyGraceExpiryIfNeeded } from "./grace";

async function claimPeriodGrant(input: {
  userId: string;
  stripeSubscriptionId: string;
  periodStart: Date;
  planId: string;
}): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("subscription_period_grants").insert({
    user_id: input.userId,
    stripe_subscription_id: input.stripeSubscriptionId,
    period_start: input.periodStart.toISOString(),
    plan_id: input.planId,
  });
  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }
  return true;
}

function periodCreditsForPlan(planId: string): number {
  const ents = entitlementsForPlan(planId);
  return (
    ents.autoFairUsePeriodCredits + (ents.frontierSoftCreditCap ?? 80_000)
  );
}

async function retrieveCheckoutSubscription(
  session: Stripe.Checkout.Session
): Promise<Stripe.Subscription | null> {
  const subRef = session.subscription;
  const subId =
    typeof subRef === "string"
      ? subRef
      : subRef && typeof subRef === "object"
        ? subRef.id
        : null;
  if (!subId) return null;

  if (typeof subRef === "object" && subRef && "items" in subRef) {
    return subRef as Stripe.Subscription;
  }

  const stripe = getStripe();
  if (!stripe) return null;
  return stripe.subscriptions.retrieve(subId);
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = await resolveUserId({
    stripeCustomerId:
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id,
    metadataUserId: session.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;

  if (session.mode === "payment") {
    const credits = Number(session.metadata?.credits ?? 0);
    if (credits > 0) {
      await grantCredits(userId, credits, "stripe_topup");
    }
    await recordBillingTelemetry({
      userId,
      eventName: "checkout_completed",
      meta: {
        mode: "payment",
        sessionId: session.id,
        credits,
        productId: session.metadata?.product_id ?? null,
      },
    });
    return;
  }

  if (session.mode === "subscription") {
    const sub = await retrieveCheckoutSubscription(session);
    if (sub) {
      const snap = await upsertSubscriptionFromStripe(userId, sub);
      if (sub.status === "active" || sub.status === "trialing") {
        await clearInferenceRestriction(userId);
      }
      await recordBillingTelemetry({
        userId,
        eventName: "checkout_completed",
        planId: snap.planId,
        meta: {
          mode: "subscription",
          sessionId: session.id,
          stripeSubscriptionId: snap.stripeSubscriptionId,
          status: snap.status,
          interval: session.metadata?.interval ?? null,
          promotionId: session.metadata?.cortaix_promotion_id ?? null,
        },
      });
      return;
    }

    await recordBillingTelemetry({
      userId,
      eventName: "checkout_completed",
      planId: session.metadata?.plan_id ?? null,
      meta: {
        mode: "subscription",
        sessionId: session.id,
        pendingSubscription: true,
      },
    });
  }
}

async function onInvoicePaid(invoice: Stripe.Invoice) {
  const userId = await resolveUserId({
    stripeCustomerId:
      typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id,
    metadataUserId: invoice.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;

  await clearInferenceRestriction(userId);

  const line = invoice.lines?.data?.[0] as
    | {
        price?: { id?: string } | string | null;
        period?: { start?: number; end?: number };
        subscription?: string | { id?: string } | null;
      }
    | undefined;
  let priceId: string | null = null;
  if (line?.price) {
    priceId = typeof line.price === "string" ? line.price : line.price.id ?? null;
  }
  if (!priceId) return;

  const packCredits = packCreditsForStripePrice(priceId);
  if (packCredits) {
    await grantCredits(userId, packCredits, "stripe_topup");
    await recordBillingTelemetry({
      userId,
      eventName: "invoice_paid_pack",
      credits: packCredits,
      meta: { invoiceId: invoice.id, priceId },
    });
    return;
  }

  const plan = planForStripePrice(priceId);
  if (!plan || plan.id === "free") return;

  const subRef = line?.subscription;
  const invoiceSub = (
    invoice as Stripe.Invoice & {
      subscription?: string | { id?: string } | null;
    }
  ).subscription;
  const stripeSubscriptionId =
    typeof subRef === "string"
      ? subRef
      : subRef && typeof subRef === "object"
        ? subRef.id ?? null
        : typeof invoiceSub === "string"
          ? invoiceSub
          : invoiceSub && typeof invoiceSub === "object"
            ? invoiceSub.id ?? null
            : null;

  const periodStartSec = line?.period?.start;
  const periodStart = periodStartSec
    ? new Date(periodStartSec * 1000)
    : new Date();

  if (stripeSubscriptionId) {
    const claimed = await claimPeriodGrant({
      userId,
      stripeSubscriptionId,
      periodStart,
      planId: plan.id,
    });
    if (!claimed) {
      await recordBillingTelemetry({
        userId,
        eventName: "subscription_period_grant_duplicate",
        planId: plan.id,
        meta: {
          invoiceId: invoice.id,
          stripeSubscriptionId,
          periodStart: periodStart.toISOString(),
        },
      });
      return;
    }
  }

  const credits = periodCreditsForPlan(plan.id);
  await grantCredits(userId, credits, `subscription_${plan.id}`);
  await recordBillingTelemetry({
    userId,
    eventName: "subscription_period_granted",
    planId: plan.id,
    credits,
    meta: {
      invoiceId: invoice.id,
      stripeSubscriptionId,
      periodStart: periodStart.toISOString(),
    },
  });
}

async function onInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const userId = await resolveUserId({
    stripeCustomerId:
      typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id,
    metadataUserId: invoice.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;
  await startPaymentGrace(userId);
  await recordBillingTelemetry({
    userId,
    eventName: "payment_failed",
    meta: {
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count ?? null,
      graceDays: GRACE_DAYS,
    },
  });
}

async function onChargeRefunded(charge: Stripe.Charge) {
  const userId = await resolveUserId({
    stripeCustomerId:
      typeof charge.customer === "string"
        ? charge.customer
        : charge.customer?.id,
    metadataUserId: charge.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;
  // Soft clawback signal — ops/support confirm unused purchased lots.
  // Does not rewrite Stripe financial history or admin grant rows.
  await recordBillingTelemetry({
    userId,
    eventName: "charge_refunded",
    meta: {
      chargeId: charge.id,
      amountRefunded: charge.amount_refunded,
      currency: charge.currency,
    },
  });
}

async function onSubscriptionUpserted(sub: Stripe.Subscription) {
  const userId = await resolveUserId({
    stripeCustomerId:
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    metadataUserId: sub.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;

  const snap = await upsertSubscriptionFromStripe(userId, sub);

  if (sub.status === "active" || sub.status === "trialing") {
    await clearInferenceRestriction(userId);
  }

  await recordBillingTelemetry({
    userId,
    eventName: "subscription_updated",
    planId: snap.planId,
    meta: {
      stripeSubscriptionId: snap.stripeSubscriptionId,
      status: snap.status,
      cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
      stripePriceId: snap.stripePriceId,
    },
  });
}

async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = await resolveUserId({
    stripeCustomerId:
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    metadataUserId: sub.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;
  await markSubscriptionCanceledLocally(userId);
}

export type { Stripe };
