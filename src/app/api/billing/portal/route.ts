import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getStripe, getOrCreateStripeCustomer, appBaseUrl } from "@/lib/billing/stripe";
import { isStripeConfigured } from "@/lib/billing/products";

export const dynamic = "force-dynamic";

/** Stripe Customer Portal for managing subscriptions / payment methods. */
export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const stripe = getStripe()!;
  const customerId = await getOrCreateStripeCustomer({
    userId: ctx.user.id,
    email: ctx.user.email,
  });
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl(request)}/vault/settings`,
  });
  return NextResponse.json({ url: session.url });
}
