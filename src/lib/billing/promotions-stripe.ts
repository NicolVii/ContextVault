import {
  isStripePaymentsEnabled,
  resolveCommercialMode,
  type CommercialMode,
} from "./commercial";
import { getStripe } from "./stripe";
import type {
  DemoStripeSimulation,
  PriceEffect,
  PromotionRecord,
} from "./promotions-types";

/**
 * Map Cortaix price-discount promotions to Stripe coupons / promotion codes.
 *
 * Demo mode: never call Stripe — return a simulated mapping snapshot.
 * Live mode: create (or reuse) Stripe Coupon + optional PromotionCode.
 * Usage bonuses are intentionally excluded — they stay inside Cortaix.
 */

export type StripePriceMappingResult = {
  mode: CommercialMode;
  stripeCouponId: string | null;
  stripePromotionCodeId: string | null;
  demoStripeSimulation: DemoStripeSimulation | null;
};

function stripeDuration(effect: PriceEffect): {
  duration: "once" | "repeating" | "forever";
  duration_in_months?: number;
} {
  if (effect.type === "trial") {
    // Trial periods are applied via subscription_data.trial_period_days at
    // checkout — no coupon object is required. Callers still get a synthetic id.
    return { duration: "once" };
  }
  if (effect.type === "limited_periods") {
    return {
      duration: "repeating",
      duration_in_months: effect.billingPeriods,
    };
  }
  if (effect.duration === "repeating") {
    return {
      duration: "repeating",
      duration_in_months: effect.durationInMonths,
    };
  }
  return { duration: effect.duration };
}

function buildDemoSimulation(
  promotionId: string,
  effect: PriceEffect,
  hasPublicCode: boolean
): DemoStripeSimulation {
  const suffix = promotionId.replace(/-/g, "").slice(0, 12);
  return {
    simulated: true,
    couponId: `demo_coupon_${suffix}`,
    promotionCodeId: hasPublicCode ? `demo_promo_${suffix}` : null,
    mappedAt: new Date().toISOString(),
    priceEffect: effect,
  };
}

/**
 * Sync a price-discount promotion to Stripe (live) or simulate (demo).
 * Returns null Stripe ids when there is no price effect.
 */
export async function syncPromotionPriceToStripe(input: {
  promotion: Pick<
    PromotionRecord,
    "id" | "slug" | "name" | "code" | "distribution" | "priceEffect" | "maxRedemptions"
  >;
  env?: NodeJS.ProcessEnv;
}): Promise<StripePriceMappingResult> {
  const env = input.env ?? process.env;
  const mode = resolveCommercialMode(env);
  const effect = input.promotion.priceEffect;

  if (!effect) {
    return {
      mode,
      stripeCouponId: null,
      stripePromotionCodeId: null,
      demoStripeSimulation: null,
    };
  }

  // Demo / disabled: never create Stripe objects.
  if (mode !== "live" || !isStripePaymentsEnabled(env)) {
    const sim = buildDemoSimulation(
      input.promotion.id,
      effect,
      input.promotion.distribution === "public_code"
    );
    return {
      mode,
      stripeCouponId: null,
      stripePromotionCodeId: null,
      demoStripeSimulation: sim,
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured for live promotions");
  }

  // Trial: no coupon — checkout applies trial_period_days from the effect.
  if (effect.type === "trial") {
    return {
      mode,
      stripeCouponId: null,
      stripePromotionCodeId: null,
      demoStripeSimulation: null,
    };
  }

  const duration = stripeDuration(effect);
  const couponParams: {
    name: string;
    duration: "once" | "repeating" | "forever";
    duration_in_months?: number;
    percent_off?: number;
    amount_off?: number;
    currency?: string;
    metadata: Record<string, string>;
  } = {
    name: input.promotion.name.slice(0, 40),
    duration: duration.duration,
    metadata: {
      cortaix_promotion_id: input.promotion.id,
      cortaix_promotion_slug: input.promotion.slug,
    },
  };
  if (duration.duration_in_months) {
    couponParams.duration_in_months = duration.duration_in_months;
  }

  if (effect.type === "percentage" || effect.type === "limited_periods") {
    couponParams.percent_off =
      effect.type === "limited_periods" ? effect.percentOff : effect.percentOff;
  } else if (effect.type === "fixed") {
    couponParams.amount_off = effect.amountOffEurCents;
    couponParams.currency = "eur";
  }

  const coupon = await stripe.coupons.create(couponParams);

  let promotionCodeId: string | null = null;
  if (
    input.promotion.distribution === "public_code" &&
    input.promotion.code
  ) {
    const promoCode = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code: input.promotion.code,
      max_redemptions: input.promotion.maxRedemptions ?? undefined,
      metadata: {
        cortaix_promotion_id: input.promotion.id,
        cortaix_promotion_slug: input.promotion.slug,
      },
    });
    promotionCodeId = promoCode.id;
  }

  return {
    mode,
    stripeCouponId: coupon.id,
    stripePromotionCodeId: promotionCodeId,
    demoStripeSimulation: null,
  };
}

/**
 * Resolve Stripe discount payload for Checkout from a redeemed / active promo.
 * Demo mode returns a simulated discount descriptor (caller must not pass to Stripe).
 */
export function resolveCheckoutDiscountFromPromotion(input: {
  promotion: Pick<
    PromotionRecord,
    | "priceEffect"
    | "stripeCouponId"
    | "stripePromotionCodeId"
    | "demoStripeSimulation"
  >;
  env?: NodeJS.ProcessEnv;
}): {
  liveDiscounts: { coupon: string }[] | null;
  trialDays: number | null;
  demoSimulatedDiscount: DemoStripeSimulation | null;
} {
  const env = input.env ?? process.env;
  const mode = resolveCommercialMode(env);
  const effect = input.promotion.priceEffect;

  if (!effect) {
    return {
      liveDiscounts: null,
      trialDays: null,
      demoSimulatedDiscount: null,
    };
  }

  if (effect.type === "trial") {
    return {
      liveDiscounts: null,
      trialDays: effect.trialDays,
      demoSimulatedDiscount:
        mode === "live" ? null : input.promotion.demoStripeSimulation,
    };
  }

  if (mode === "live" && isStripePaymentsEnabled(env)) {
    if (input.promotion.stripeCouponId) {
      return {
        liveDiscounts: [{ coupon: input.promotion.stripeCouponId }],
        trialDays: null,
        demoSimulatedDiscount: null,
      };
    }
    return {
      liveDiscounts: null,
      trialDays: null,
      demoSimulatedDiscount: null,
    };
  }

  return {
    liveDiscounts: null,
    trialDays: null,
    demoSimulatedDiscount: input.promotion.demoStripeSimulation,
  };
}
