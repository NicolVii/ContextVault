import type Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { grantCredits } from "@/lib/inference/credits";
import {
  packCreditsForStripePrice,
  planForStripePrice,
} from "./products";

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

/**
 * Idempotent Stripe event handler.
 * Duplicate deliveries (same event.id) return success without re-granting credits.
 * If processing fails after claim, the claim is released so Stripe retries can succeed.
 */
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
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "invoice.paid":
      await onInvoicePaid(event.data.object as Stripe.Invoice);
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

  const line = invoice.lines?.data?.[0] as
    | { price?: { id?: string } | string | null }
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
  if (plan && plan.monthlyCredits > 0) {
    await grantCredits(userId, plan.monthlyCredits, `subscription_${plan.id}`);
  }
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

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      plan_id: plan?.id ?? "pro",
      status: sub.status,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
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
}

export type { Stripe };
