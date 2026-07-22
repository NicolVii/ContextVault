/**
 * Plan entitlements — product gates independent of raw credit display.
 * Soft ceilings protect COGS without marketing “unlimited Frontier.”
 *
 * `PLAN_ENTITLEMENTS` are the safe TypeScript defaults. Runtime resolution
 * prefers the database-backed catalog (via {@link entitlementsForPlan}) and
 * falls back here when config is missing or malformed.
 */

import {
  PLAN_ENTITLEMENTS as DEFAULT_PLAN_ENTITLEMENTS,
  type PlanEntitlements,
} from "./plan-defaults";
import {
  entitlementsFromCatalog,
  resolvePlanCatalogSync,
} from "./plan-config";

export type { PlanEntitlements };

/** Safe hardcoded defaults — also used when DB config is missing/invalid. */
export const PLAN_ENTITLEMENTS = DEFAULT_PLAN_ENTITLEMENTS;

/**
 * Resolve entitlements for a plan id.
 * Uses the in-process catalog cache when warmed from the database; otherwise
 * TypeScript defaults. Unknown / canceled / legacy ids → Free gates.
 */
export function entitlementsForPlan(planId: string): PlanEntitlements {
  return entitlementsFromCatalog(resolvePlanCatalogSync(), planId);
}

export function isPaidPlan(planId: string): boolean {
  return planId === "lite" || planId === "pro";
}
