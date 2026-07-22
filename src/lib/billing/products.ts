/**
 * Cortaix commercial products — Free / Lite / Pro launch catalog.
 * Credits remain the internal meter; customers see Auto vs Frontier.
 * Stripe Price IDs come from env so local/dev can run without Stripe.
 * Catalog is extensible for future qualitative tiers (not Max-as-more-usage).
 *
 * `SUBSCRIPTION_PLANS` are the safe TypeScript defaults. Runtime helpers prefer
 * the database-backed catalog when the server cache is warmed.
 */

import { getFeatureFlags } from "./commercial";
import {
  CREDIT_PACKS as DEFAULT_CREDIT_PACKS,
  SUBSCRIPTION_PLANS as DEFAULT_SUBSCRIPTION_PLANS,
  type CreditPack,
  type FuturePlanId,
  type LaunchPlanId,
  type PlanId,
  type SubscriptionPlan,
} from "./plan-defaults";
import {
  publicPlansFromCatalog,
  resolvePlanCatalogSync,
  subscriptionPlanFromCatalog,
} from "./plan-config";

export type { CreditPack, FuturePlanId, LaunchPlanId, PlanId, SubscriptionPlan };

/** Optional single top-up pack — not a wallet storefront. */
export const CREDIT_PACKS = DEFAULT_CREDIT_PACKS;

/** Safe hardcoded defaults — also used when DB config is missing/invalid. */
export const SUBSCRIPTION_PLANS = DEFAULT_SUBSCRIPTION_PLANS;

export function getPublicPlans(): SubscriptionPlan[] {
  return publicPlansFromCatalog(resolvePlanCatalogSync());
}

export function getPublicPacks(
  env: NodeJS.ProcessEnv = process.env
): CreditPack[] {
  if (!getFeatureFlags(env).creditPackStorefront) return [];
  return CREDIT_PACKS.filter((p) => p.public);
}

export function getCreditPack(id: string): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

export function getSubscriptionPlan(id: string): SubscriptionPlan | null {
  return subscriptionPlanFromCatalog(resolvePlanCatalogSync(), id);
}

export function packCreditsForStripePrice(priceId: string): number | null {
  for (const pack of CREDIT_PACKS) {
    const envPrice = process.env[pack.stripePriceEnv];
    if (envPrice && envPrice === priceId) return pack.credits;
  }
  return null;
}

export function planForStripePrice(priceId: string): SubscriptionPlan | null {
  const catalog = resolvePlanCatalogSync();
  for (const planId of ["free", "lite", "pro"] as const) {
    const plan = catalog.plans[planId];
    for (const envKey of [plan.stripePriceEnvMonthly, plan.stripePriceEnvAnnual]) {
      if (!envKey) continue;
      const envPrice = process.env[envKey];
      if (envPrice && envPrice === priceId) return plan;
    }
  }
  return null;
}

/**
 * Whether a Stripe secret key is present.
 * Prefer {@link isStripePaymentsEnabled} / {@link assertCheckoutAllowed} for
 * authorizing Checkout or Portal — key presence alone is not enough.
 */
export function isStripeConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim());
}

export function formatEurCents(cents: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
