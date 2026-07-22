import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/webhook";
import { recordBillingTelemetry } from "@/lib/billing/telemetry";

export const dynamic = "force-dynamic";

/** Stripe webhooks — raw body required for signature verification. */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      processed: result.processed,
    });
  } catch (err) {
    console.error("stripe webhook handler failed", err);
    await recordBillingTelemetry({
      eventName: "webhook_failed",
      meta: {
        eventId: event.id,
        eventType: event.type,
        error: err instanceof Error ? err.message : "Handler failed",
      },
    });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
