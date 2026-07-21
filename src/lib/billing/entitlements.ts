import type { LaunchPlanId } from "./products";

/**
 * Plan entitlements — product gates independent of raw credit display.
 * Soft ceilings protect COGS without marketing “unlimited Frontier.”
 */

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
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

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
  },
};

export function entitlementsForPlan(planId: string): PlanEntitlements {
  if (planId === "lite" || planId === "pro" || planId === "free") {
    return PLAN_ENTITLEMENTS[planId];
  }
  // Unknown / canceled / legacy team → Free gates
  return PLAN_ENTITLEMENTS.free;
}

export function isPaidPlan(planId: string): boolean {
  return planId === "lite" || planId === "pro";
}
