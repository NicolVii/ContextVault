import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getStripe, getOrCreateStripeCustomer, appBaseUrl } from "@/lib/billing/stripe";
import {
  getCreditPack,
  getSubscriptionPlan,
  isStripeConfigured,
} from "@/lib/billing/products";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["pack", "subscription"]),
  productId: z.string().min(1),
});

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: "Stripe is not configured. Use local top-up in development.",
        code: "stripe_not_configured",
      },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const stripe = getStripe()!;
  const customerId = await getOrCreateStripeCustomer({
    userId: ctx.user.id,
    email: ctx.user.email,
  });
  const base = appBaseUrl(request);

  if (parsed.data.kind === "pack") {
    const pack = getCreditPack(parsed.data.productId);
    if (!pack) return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
    const priceId = process.env[pack.stripePriceEnv];
    if (!priceId) {
      return NextResponse.json(
        { error: `Missing env ${pack.stripePriceEnv}` },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/vault/settings?billing=success`,
      cancel_url: `${base}/vault/settings?billing=cancel`,
      metadata: {
        cortaix_user_id: ctx.user.id,
        credits: String(pack.credits),
        product_id: pack.id,
      },
    });
    return NextResponse.json({ url: session.url });
  }

  const plan = getSubscriptionPlan(parsed.data.productId);
  if (!plan || plan.id === "free" || !plan.stripePriceEnv) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  const priceId = process.env[plan.stripePriceEnv];
  if (!priceId) {
    return NextResponse.json(
      { error: `Missing env ${plan.stripePriceEnv}` },
      { status: 500 }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/vault/settings?billing=success`,
    cancel_url: `${base}/vault/settings?billing=cancel`,
    metadata: {
      cortaix_user_id: ctx.user.id,
      plan_id: plan.id,
    },
    subscription_data: {
      metadata: { cortaix_user_id: ctx.user.id, plan_id: plan.id },
    },
  });

  return NextResponse.json({ url: session.url });
}
