import { z } from "zod";

/**
 * Cortaix promotions — shared types and Zod validation.
 *
 * Price discounts and entitlement/usage bonuses are modeled as separate
 * effect objects on a single promotion. Either or both may be present.
 */

export const PROMOTION_STATUSES = [
  "draft",
  "active",
  "paused",
  "ended",
  "archived",
] as const;

export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const PROMOTION_DISTRIBUTIONS = ["public_code", "automatic"] as const;
export type PromotionDistribution = (typeof PROMOTION_DISTRIBUTIONS)[number];

export const PROMOTION_AUDIENCES = [
  "all",
  "new_users",
  "existing_users",
] as const;
export type PromotionAudience = (typeof PROMOTION_AUDIENCES)[number];

export const PROMOTION_REDEMPTION_SOURCES = [
  "code",
  "automatic",
  "admin",
] as const;
export type PromotionRedemptionSource =
  (typeof PROMOTION_REDEMPTION_SOURCES)[number];

export const PROMOTION_REDEMPTION_STATUSES = [
  "applied",
  "expired",
  "revoked",
] as const;
export type PromotionRedemptionStatus =
  (typeof PROMOTION_REDEMPTION_STATUSES)[number];

export const LAUNCH_PLAN_IDS = ["free", "lite", "pro"] as const;
export type PromotionPlanId = (typeof LAUNCH_PLAN_IDS)[number];

const featureAccessSchema = z
  .object({
    attachments: z.boolean().optional(),
    byok: z.boolean().optional(),
    voice: z.boolean().optional(),
    elevatedLimits: z.boolean().optional(),
  })
  .strict();

/** Price discount effects — may map to Stripe coupons in live mode only. */
export const priceEffectSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z.literal("percentage"),
        percentOff: z.number().min(1).max(100),
        /** once | repeating | forever */
        duration: z.enum(["once", "repeating", "forever"]).default("once"),
        durationInMonths: z.number().int().positive().max(36).optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("fixed"),
        amountOffEurCents: z.number().int().positive().max(1_000_000),
        duration: z.enum(["once", "repeating", "forever"]).default("once"),
        durationInMonths: z.number().int().positive().max(36).optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("trial"),
        trialDays: z.number().int().positive().max(365),
      })
      .strict(),
    z
      .object({
        type: z.literal("limited_periods"),
        /** Number of billing periods the discount applies (maps to repeating coupon). */
        billingPeriods: z.number().int().positive().max(36),
        /** Optional percentage off during those periods (default 100 = free periods). */
        percentOff: z.number().min(1).max(100).default(100),
      })
      .strict(),
  ])
  .superRefine((val, ctx) => {
    if (
      (val.type === "percentage" || val.type === "fixed") &&
      val.duration === "repeating" &&
      !val.durationInMonths
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "durationInMonths is required when duration is repeating",
        path: ["durationInMonths"],
      });
    }
  });

export type PriceEffect = z.infer<typeof priceEffectSchema>;

/** Entitlement / usage bonuses — always first-party; never Stripe objects. */
export const bonusEffectSchema = z
  .object({
    autoTurnBonus: z.number().int().nonnegative().optional(),
    frontierTurnBonus: z.number().int().nonnegative().optional(),
    creditBonus: z.number().int().nonnegative().optional(),
    /** Additive storage bytes on top of the user's effective plan. */
    storageBytesBonus: z.number().int().nonnegative().optional(),
    /** Temporary feature access overlays. */
    featureAccess: featureAccessSchema.optional(),
    /**
     * How long bonus entitlements last after redemption (days).
     * Null/omitted = until promotion ends_at or indefinitely.
     */
    durationDays: z.number().int().positive().max(3650).nullable().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const hasBonus =
      (val.autoTurnBonus ?? 0) > 0 ||
      (val.frontierTurnBonus ?? 0) > 0 ||
      (val.creditBonus ?? 0) > 0 ||
      (val.storageBytesBonus ?? 0) > 0 ||
      (val.featureAccess && Object.keys(val.featureAccess).length > 0);
    if (!hasBonus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "bonusEffect must include at least one of: auto/frontier turns, credits, storage, or feature access",
      });
    }
  });

export type BonusEffect = z.infer<typeof bonusEffectSchema>;

export const promotionInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "slug must be lowercase kebab-case"
      ),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    distribution: z.enum(PROMOTION_DISTRIBUTIONS),
    code: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[A-Z0-9_-]+$/i, "code must be alphanumeric")
      .nullable()
      .optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    maxRedemptionsPerUser: z.number().int().positive().max(100).default(1),
    eligiblePlans: z.array(z.enum(LAUNCH_PLAN_IDS)).default([]),
    audience: z.enum(PROMOTION_AUDIENCES).default("all"),
    priceEffect: priceEffectSchema.nullable().optional(),
    bonusEffect: bonusEffectSchema.nullable().optional(),
    reason: z.string().trim().min(3).max(2000),
  })
  .superRefine((val, ctx) => {
    if (val.distribution === "public_code") {
      if (!val.code || !val.code.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "code is required for public_code promotions",
          path: ["code"],
        });
      }
    } else if (val.code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "automatic promotions must not have a code",
        path: ["code"],
      });
    }

    if (val.endsAt && new Date(val.endsAt) <= new Date(val.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endsAt must be after startsAt",
        path: ["endsAt"],
      });
    }

    if (!val.priceEffect && !val.bonusEffect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of priceEffect or bonusEffect is required",
        path: ["priceEffect"],
      });
    }
  });

export type PromotionInput = z.infer<typeof promotionInputSchema>;

export type DemoStripeSimulation = {
  simulated: true;
  couponId: string;
  promotionCodeId: string | null;
  mappedAt: string;
  priceEffect: PriceEffect;
};

export type PromotionRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: PromotionStatus;
  distribution: PromotionDistribution;
  code: string | null;
  startsAt: string;
  endsAt: string | null;
  pausedAt: string | null;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  eligiblePlans: PromotionPlanId[];
  audience: PromotionAudience;
  priceEffect: PriceEffect | null;
  bonusEffect: BonusEffect | null;
  stripeCouponId: string | null;
  stripePromotionCodeId: string | null;
  demoStripeSimulation: DemoStripeSimulation | null;
  redemptionCount: number;
  reason: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromotionRedemption = {
  id: string;
  promotionId: string;
  userId: string;
  redeemedAt: string;
  source: PromotionRedemptionSource;
  codeUsed: string | null;
  status: PromotionRedemptionStatus;
  expiresAt: string | null;
  revokedAt: string | null;
  priceDiscountApplied: PriceEffect | null;
  bonusApplied: BonusEffect | null;
  stripeCouponId: string | null;
  stripePromotionCodeId: string | null;
  demoSimulated: boolean;
  entitlementGrantId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

/** Normalize public codes to uppercase for storage and lookup. */
export function normalizePromotionCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isPromotionWindowOpen(
  promo: Pick<PromotionRecord, "startsAt" | "endsAt" | "status" | "pausedAt">,
  now: Date = new Date()
): boolean {
  if (promo.status !== "active") return false;
  if (promo.pausedAt) return false;
  const start = new Date(promo.startsAt);
  if (Number.isNaN(start.getTime()) || start.getTime() > now.getTime()) {
    return false;
  }
  if (promo.endsAt) {
    const end = new Date(promo.endsAt);
    if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) {
      return false;
    }
  }
  return true;
}

export function parsePriceEffect(raw: unknown): PriceEffect | null {
  if (raw == null) return null;
  const parsed = priceEffectSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseBonusEffect(raw: unknown): BonusEffect | null {
  if (raw == null) return null;
  const parsed = bonusEffectSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function requirePromotionReason(
  reason: string | null | undefined
): string {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 3) {
    throw new Error("A reason of at least 3 characters is required");
  }
  return trimmed;
}
