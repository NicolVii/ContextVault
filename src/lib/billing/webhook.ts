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

export async function handleStripeEvent(
  event: Stripe.Event
): Promise<HandleStripeEventResult> {
  const claim = await claimStripeEvent(event.id, event.type);
  if (claim === "duplicate") {
    return { duplicate: true, processed: false };
  }

  try {
    await dispatchStripeEvent(event);
    return { duplicate: false, processed: true };
  } catch (err) {
    await releaseStripeEventClaim(event.id);
    throw err;
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
      await upsertSubscription(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }
}

/** Test/helper export for unit coverage of grant paths without claim wrapping. */
export async function dispatchStripeEventForTests(event: Stripe.Event): Promise<void> {
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

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = await resolveUserId({
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : session.customer?.id,
    metadataUserId: session.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;

  if (session.mode === "payment") {
    const credits = Number(session.metadata?.credits ?? 0);
    if (credits > 0) {
      await grantCredits(userId, credits, "stripe_topup");
    }
  }
}

async function onInvoicePaid(invoice: Stripe.Invoice) {
  const userId = await resolveUserId({
    stripeCustomerId:
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
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
    return;
  }

  const plan = planForStripePrice(priceId);
  if (!plan || plan.id === "free") return;

  const subRef = line?.subscription;
  const invoiceSub = (invoice as Stripe.Invoice & {
    subscription?: string | { id?: string } | null;
  }).subscription;
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
    if (!claimed) return;
  }

  const credits = periodCreditsForPlan(plan.id);
  await grantCredits(userId, credits, `subscription_${plan.id}`);
  await recordBillingTelemetry({
    userId,
    eventName: "subscription_period_granted",
    planId: plan.id,
    credits,
  });
}

async function onInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const userId = await resolveUserId({
    stripeCustomerId:
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
    metadataUserId: invoice.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;
  await startPaymentGrace(userId);
  await recordBillingTelemetry({
    userId,
    eventName: "payment_failed",
    meta: { invoiceId: invoice.id },
  });
}

async function onChargeRefunded(charge: Stripe.Charge) {
  const userId = await resolveUserId({
    stripeCustomerId:
      typeof charge.customer === "string" ? charge.customer : charge.customer?.id,
    metadataUserId: charge.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;
  // Soft clawback signal — ops/support confirm unused purchased lots.
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

async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = await resolveUserId({
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    metadataUserId: sub.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const plan = priceId ? planForStripePrice(priceId) : null;
  const admin = createSupabaseAdminClient();
  const periodEnd =
    (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end ??
    sub.items.data[0]?.current_period_end;

  const planId = plan?.id ?? (sub.metadata?.plan_id as string | undefined) ?? "free";

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      plan_id: planId === "team" ? "free" : planId,
      status: sub.status,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (sub.status === "active" || sub.status === "trialing") {
    await clearInferenceRestriction(userId);
  }
}

async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = await resolveUserId({
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    metadataUserId: sub.metadata?.cortaix_user_id ?? null,
  });
  if (!userId) return;
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

export type { Stripe };
