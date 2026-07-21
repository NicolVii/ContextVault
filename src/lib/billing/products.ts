/**
 * Cortaix commercial products — Free / Lite / Pro launch catalog.
 * Credits remain the internal meter; customers see Auto vs Frontier.
 * Stripe Price IDs come from env so local/dev can run without Stripe.
 * Catalog is extensible for future qualitative tiers (not Max-as-more-usage).
 */

export type LaunchPlanId = "free" | "lite" | "pro";

/** Reserved for future qualitative products — never shown at launch. */
export type FuturePlanId = "private" | "executive" | "concierge" | "team";

export type PlanId = LaunchPlanId | FuturePlanId;

export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  /** Gross consumer price in euro cents (VAT-inclusive display assumption). */
  amountEurCents: number;
  stripePriceEnv: string;
  /** Packs are optional at launch; keep one small Frontier-oriented top-up. */
  public: boolean;
}

export interface SubscriptionPlan {
  id: LaunchPlanId;
  label: string;
  purpose: string;
  /** Gross monthly price in euro cents; 0 for Free. */
  amountEurCentsMonthly: number;
  /** Gross annual price in euro cents when offered. */
  amountEurCentsAnnual?: number;
  stripePriceEnvMonthly?: string;
  stripePriceEnvAnnual?: string;
  /** Founding / promo monthly price (euro cents); checkout may use a coupon. */
  foundingEurCentsMonthly?: number;
  features: string[];
  /** Public storefront — Team/Max-style tiers stay false. */
  public: boolean;
}

/** Optional single top-up pack — not a wallet storefront. */
export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "pack_frontier_boost",
    label: "Frontier boost",
    credits: 100_000,
    amountEurCents: 1_000,
    stripePriceEnv: "STRIPE_PRICE_PACK_FRONTIER_BOOST",
    public: false,
  },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    label: "Free",
    purpose: "Keep your memory alive",
    amountEurCentsMonthly: 0,
    features: [
      "About 30 Auto conversations / month",
      "Persistent memory",
      "Search, review, and export",
    ],
    public: true,
  },
  {
    id: "lite",
    label: "Lite",
    purpose: "Explore Cortaix affordably",
    amountEurCentsMonthly: 500,
    amountEurCentsAnnual: 5_000,
    stripePriceEnvMonthly: "STRIPE_PRICE_LITE_MONTHLY",
    stripePriceEnvAnnual: "STRIPE_PRICE_LITE_ANNUAL",
    features: [
      "Unlimited Auto under fair use",
      "About 10 Frontier conversations / month",
      "100 MB file library",
      "Export",
    ],
    public: true,
  },
  {
    id: "pro",
    label: "Pro",
    purpose: "The complete Cortaix experience",
    amountEurCentsMonthly: 2_800,
    amountEurCentsAnnual: 28_000,
    foundingEurCentsMonthly: 2_500,
    stripePriceEnvMonthly: "STRIPE_PRICE_PRO_MONTHLY",
    stripePriceEnvAnnual: "STRIPE_PRICE_PRO_ANNUAL",
    features: [
      "Unlimited Auto",
      "Generous Frontier access",
      "Every frontier model family",
      "Voice · BYOK · higher limits",
      "Full memory intelligence",
    ],
    public: true,
  },
];

export function getPublicPlans(): SubscriptionPlan[] {
  return SUBSCRIPTION_PLANS.filter((p) => p.public);
}

export function getPublicPacks(): CreditPack[] {
  return CREDIT_PACKS.filter((p) => p.public);
}

export function getCreditPack(id: string): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

export function getSubscriptionPlan(id: string): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id) ?? null;
}

export function packCreditsForStripePrice(priceId: string): number | null {
  for (const pack of CREDIT_PACKS) {
    const envPrice = process.env[pack.stripePriceEnv];
    if (envPrice && envPrice === priceId) return pack.credits;
  }
  return null;
}

export function planForStripePrice(priceId: string): SubscriptionPlan | null {
  for (const plan of SUBSCRIPTION_PLANS) {
    for (const envKey of [plan.stripePriceEnvMonthly, plan.stripePriceEnvAnnual]) {
      if (!envKey) continue;
      const envPrice = process.env[envKey];
      if (envPrice && envPrice === priceId) return plan;
    }
  }
  return null;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function formatEurCents(cents: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
