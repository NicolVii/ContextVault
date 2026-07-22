/**
 * Hardcoded Free / Lite / Pro defaults.
 * Used when the database catalog is unavailable or a row fails validation.
 * Keep in sync with supabase/migrations/*_plan_entitlement_config.sql seed.
 */

export type LaunchPlanId = "free" | "lite" | "pro";

/** Reserved for future qualitative products — never shown at launch. */
export type FuturePlanId = "private" | "executive" | "concierge" | "team";

export type PlanId = LaunchPlanId | FuturePlanId;

/**
 * Frontier model-family ids (vendor keys from the inference catalog).
 * Empty list = no frontier family access (Free default).
 */
export const MODEL_FAMILIES = [
  "openai",
  "anthropic",
  "google",
  "meta",
] as const;

export type ModelFamilyId = (typeof MODEL_FAMILIES)[number];

export const ALL_MODEL_FAMILIES: ModelFamilyId[] = [...MODEL_FAMILIES];

export function isModelFamilyId(value: string): value is ModelFamilyId {
  return (MODEL_FAMILIES as readonly string[]).includes(value);
}

export interface PlanEntitlements {
  planId: LaunchPlanId;
  /** Free: hard monthly Auto turn cap. Null = unlimited under fair use. */
  autoMonthlyTurns: number | null;
  unlimitedAuto: boolean;
  /** Soft Auto credit ceiling per calendar day (abuse brake). */
  autoFairUseDailyCredits: number;
  /** Soft Auto credit ceiling per billing period. */
  autoFairUsePeriodCredits: number;
  /** Lite: hard Frontier turn count. Null = no visible counter (Pro). */
  frontierMonthlyTurns: number | null;
  /** Max credits debited for a single Frontier turn (context abuse guard). */
  maxFrontierCreditsPerTurn: number;
  /** Pro: internal Frontier credit soft-cap per period (not shown as a counter). */
  frontierSoftCreditCap: number | null;
  /** Threshold (0–1) of soft cap at which UI shows “using Frontier heavily”. */
  frontierHeavyRatio: number;
  attachments: boolean;
  storageBytes: number;
  byok: boolean;
  voice: boolean;
  /** Higher context / document limits for Pro. */
  elevatedLimits: boolean;
  /** Allowed frontier model families for this plan. */
  modelFamilies: ModelFamilyId[];
}

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

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Safe hardcoded entitlement defaults. */
export const PLAN_ENTITLEMENTS: Record<LaunchPlanId, PlanEntitlements> = {
  free: {
    planId: "free",
    autoMonthlyTurns: 30,
    unlimitedAuto: false,
    autoFairUseDailyCredits: 8_000,
    autoFairUsePeriodCredits: 8_000,
    frontierMonthlyTurns: 0,
    maxFrontierCreditsPerTurn: 0,
    frontierSoftCreditCap: 0,
    frontierHeavyRatio: 0.8,
    attachments: false,
    storageBytes: 0,
    byok: false,
    voice: false,
    elevatedLimits: false,
    modelFamilies: [],
  },
  lite: {
    planId: "lite",
    autoMonthlyTurns: null,
    unlimitedAuto: true,
    autoFairUseDailyCredits: 50_000,
    autoFairUsePeriodCredits: 400_000,
    frontierMonthlyTurns: 10,
    maxFrontierCreditsPerTurn: 8_000,
    frontierSoftCreditCap: null,
    frontierHeavyRatio: 0.8,
    attachments: true,
    storageBytes: 100 * MB,
    byok: false,
    voice: false,
    elevatedLimits: false,
    modelFamilies: [...ALL_MODEL_FAMILIES],
  },
  pro: {
    planId: "pro",
    autoMonthlyTurns: null,
    unlimitedAuto: true,
    autoFairUseDailyCredits: 200_000,
    autoFairUsePeriodCredits: 2_000_000,
    frontierMonthlyTurns: null,
    maxFrontierCreditsPerTurn: 50_000,
    frontierSoftCreditCap: 400_000,
    frontierHeavyRatio: 0.8,
    attachments: true,
    storageBytes: 5 * GB,
    byok: true,
    voice: true,
    elevatedLimits: true,
    modelFamilies: [...ALL_MODEL_FAMILIES],
  },
};

/** Safe hardcoded product catalog defaults. */
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
