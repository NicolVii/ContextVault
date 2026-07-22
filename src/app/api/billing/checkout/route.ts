import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getStripe, getOrCreateStripeCustomer, appBaseUrl } from "@/lib/billing/stripe";
import { getCreditPack, getSubscriptionPlan } from "@/lib/billing/products";
import { assertCheckoutAllowed } from "@/lib/billing/commercial";
import { recordBillingTelemetry } from "@/lib/billing/telemetry";
import { ensurePlanConfigLoaded } from "@/lib/billing/plan-config-loader";
import {
  getPromotionById,
  listRedemptionsForUser,
  resolveCheckoutDiscountFromPromotion,
} from "@/lib/billing";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["pack", "subscription"]),
  productId: z.string().min(1),
  /** monthly | annual — subscriptions only */
  interval: z.enum(["monthly", "annual"]).optional().default("monthly"),
  /** Apply founding Pro coupon when configured */
  founding: z.boolean().optional(),
  /** Optional Cortaix promotion id previously redeemed by the user */
  promotionId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = assertCheckoutAllowed();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, code: gate.code },
      { status: gate.status }
    );
  }

  await ensurePlanConfigLoaded();

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
  const successUrl = `${base}/vault/plan?billing=success`;
  const cancelUrl = `${base}/vault/plan?billing=cancel`;

  const consentCopy =
    "By confirming, you agree to the Cortaix Terms of Service, Privacy Policy, and Subscription & Billing Terms. Subscriptions renew until canceled.";

  if (parsed.data.kind === "pack") {
    const pack = getCreditPack(parsed.data.productId);
    if (!pack || !pack.public) {
      return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
    }
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
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      consent_collection: { terms_of_service: "required" },
      custom_text: {
        terms_of_service_acceptance: { message: consentCopy },
      },
      metadata: {
        cortaix_user_id: ctx.user.id,
        credits: String(pack.credits),
        product_id: pack.id,
      },
    });
    await recordBillingTelemetry({
      userId: ctx.user.id,
      eventName: "checkout_started",
      meta: { kind: "pack", productId: pack.id },
    });
    return NextResponse.json({ url: session.url });
  }

  const plan = getSubscriptionPlan(parsed.data.productId);
  if (!plan || plan.id === "free" || !plan.public) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const envKey =
    parsed.data.interval === "annual"
      ? plan.stripePriceEnvAnnual
      : plan.stripePriceEnvMonthly;
  if (!envKey) {
    return NextResponse.json({ error: "Price not configured for interval" }, { status: 400 });
  }
  const priceId = process.env[envKey];
  if (!priceId) {
    return NextResponse.json({ error: `Missing env ${envKey}` }, { status: 500 });
  }

  const discounts: { coupon: string }[] = [];
  let trialDays: number | null = null;
  let appliedPromotionId: string | null = null;

  if (parsed.data.promotionId) {
    const redemptions = await listRedemptionsForUser(ctx.user.id);
    const redeemed = redemptions.find(
      (r) =>
        r.promotionId === parsed.data.promotionId &&
        r.status === "applied" &&
        r.priceDiscountApplied
    );
    if (!redeemed) {
      return NextResponse.json(
        { error: "Promotion not redeemed or has no price discount" },
        { status: 400 }
      );
    }
    const promo = await getPromotionById(parsed.data.promotionId);
    if (!promo) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 400 });
    }
    const mapped = resolveCheckoutDiscountFromPromotion({ promotion: promo });
    if (mapped.demoSimulatedDiscount) {
      // Live checkout must never receive demo-simulated discounts.
      return NextResponse.json(
        {
          error:
            "Promotion price discount is demo-simulated and cannot be used in live Checkout",
          code: "promotion_demo_simulated",
        },
        { status: 400 }
      );
    }
    if (mapped.liveDiscounts?.length) {
      discounts.push(...mapped.liveDiscounts);
      appliedPromotionId = promo.id;
    }
    if (mapped.trialDays) {
      trialDays = mapped.trialDays;
      appliedPromotionId = promo.id;
    }
  }

  if (
    discounts.length === 0 &&
    parsed.data.founding &&
    plan.id === "pro" &&
    process.env.STRIPE_COUPON_PRO_FOUNDING?.trim()
  ) {
    discounts.push({ coupon: process.env.STRIPE_COUPON_PRO_FOUNDING.trim() });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    billing_address_collection: "required",
    customer_update: { address: "auto", name: "auto" },
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: true },
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: { message: consentCopy },
    },
    ...(discounts.length > 0
      ? { discounts }
      : { allow_promotion_codes: true }),
    metadata: {
      cortaix_user_id: ctx.user.id,
      plan_id: plan.id,
      interval: parsed.data.interval,
      ...(appliedPromotionId
        ? { cortaix_promotion_id: appliedPromotionId }
        : {}),
    },
    subscription_data: {
      metadata: {
        cortaix_user_id: ctx.user.id,
        plan_id: plan.id,
        ...(appliedPromotionId
          ? { cortaix_promotion_id: appliedPromotionId }
          : {}),
      },
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
  });

  await recordBillingTelemetry({
    userId: ctx.user.id,
    eventName: "checkout_started",
    planId: plan.id,
    meta: {
      kind: "subscription",
      interval: parsed.data.interval,
      promotionId: appliedPromotionId,
    },
  });

  return NextResponse.json({ url: session.url });
}
