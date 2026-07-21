/**
 * Cortaix commercial products — credits are the customer currency.
 * Stripe Price IDs come from env so local/dev can run without Stripe.
 */

export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  amountUsdCents: number;
  /** Stripe Price id when configured. */
  stripePriceEnv: string;
}

export interface SubscriptionPlan {
  id: "free" | "pro" | "team";
  label: string;
  monthlyCredits: number;
  stripePriceEnv?: string;
  features: string[];
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "pack_100k",
    label: "100k credits",
    credits: 100_000,
    amountUsdCents: 1_000,
    stripePriceEnv: "STRIPE_PRICE_PACK_100K",
  },
  {
    id: "pack_500k",
    label: "500k credits",
    credits: 500_000,
    amountUsdCents: 4_000,
    stripePriceEnv: "STRIPE_PRICE_PACK_500K",
  },
  {
    id: "pack_2m",
    label: "2M credits",
    credits: 2_000_000,
    amountUsdCents: 12_000,
    stripePriceEnv: "STRIPE_PRICE_PACK_2M",
  },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    label: "Free",
    monthlyCredits: 0,
    features: ["Signup credit grant", "Memory vault", "Thinking"],
  },
  {
    id: "pro",
    label: "Pro",
    monthlyCredits: 500_000,
    stripePriceEnv: "STRIPE_PRICE_PRO_MONTHLY",
    features: ["500k credits / month", "Priority models", "Email support"],
  },
  {
    id: "team",
    label: "Team",
    monthlyCredits: 2_000_000,
    stripePriceEnv: "STRIPE_PRICE_TEAM_MONTHLY",
    features: ["2M credits / month", "BYOK", "Shared workspaces"],
  },
];

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
    if (!plan.stripePriceEnv) continue;
    const envPrice = process.env[plan.stripePriceEnv];
    if (envPrice && envPrice === priceId) return plan;
  }
  return null;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
