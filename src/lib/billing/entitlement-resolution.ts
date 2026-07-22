import {
  entitlementsForPlan,
  isPaidPlan,
  type PlanEntitlements,
} from "./entitlements";
import type { LaunchPlanId } from "./products";

/**
 * Effective entitlement priority (highest first):
 * 1. active plan simulation
 * 2. active admin entitlement grant
 * 3. real subscription
 * 4. Free fallback
 *
 * Demo / admin overrides never count as paid revenue.
 */

export type EntitlementSource =
  | "plan_simulation"
  | "admin_grant"
  | "subscription"
  | "free";

export type FeatureOverrideKey =
  | "attachments"
  | "byok"
  | "voice"
  | "elevatedLimits";

export type FeatureOverrides = Partial<
  Record<FeatureOverrideKey, boolean>
>;

/** Shared shape for grant and simulation override rows. */
export interface EntitlementOverrideInput {
  id: string;
  planId: LaunchPlanId;
  startsAt: string;
  endsAt: string | null;
  autoTurnBonus: number;
  frontierTurnBonus: number;
  creditBonus: number;
  storageBytesOverride: number | null;
  featureOverrides: FeatureOverrides;
  reason: string | null;
  createdBy: string | null;
  revokedAt: string | null;
  /** Always true for admin/demo rows; never Stripe MRR. */
  excludeFromRevenue: boolean;
  createdAt?: string;
}

export interface SubscriptionEntitlementInput {
  planId: string;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface ResolvedEntitlement {
  planId: LaunchPlanId;
  source: EntitlementSource;
  /** True when source is plan_simulation or admin_grant. */
  isDemo: boolean;
  /** Never true for simulations/grants; only real paid Stripe subs. */
  excludeFromRevenue: boolean;
  sourceId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  reason: string | null;
  entitlements: PlanEntitlements;
  currentPeriodEnd: string | null;
  planStatus: string | null;
  cancelAtPeriodEnd: boolean;
  autoTurnBonus: number;
  frontierTurnBonus: number;
  creditBonus: number;
}

export function isLaunchPlanId(value: string): value is LaunchPlanId {
  return value === "free" || value === "lite" || value === "pro";
}

export function parseFeatureOverrides(
  raw: unknown
): FeatureOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: FeatureOverrides = {};
  for (const key of [
    "attachments",
    "byok",
    "voice",
    "elevatedLimits",
  ] as const) {
    if (typeof obj[key] === "boolean") out[key] = obj[key];
  }
  return out;
}

/** Active when not revoked, started, and not past ends_at. */
export function isOverrideActive(
  row: Pick<
    EntitlementOverrideInput,
    "startsAt" | "endsAt" | "revokedAt"
  >,
  now: Date = new Date()
): boolean {
  if (row.revokedAt) return false;
  const start = new Date(row.startsAt);
  if (Number.isNaN(start.getTime()) || start.getTime() > now.getTime()) {
    return false;
  }
  if (row.endsAt) {
    const end = new Date(row.endsAt);
    if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) {
      return false;
    }
  }
  return true;
}

/**
 * Among active candidates, prefer the newest by createdAt then startsAt.
 */
export function pickActiveOverride(
  rows: EntitlementOverrideInput[],
  now: Date = new Date()
): EntitlementOverrideInput | null {
  const active = rows.filter((r) => isOverrideActive(r, now));
  if (active.length === 0) return null;
  active.sort((a, b) => {
    const aKey = a.createdAt ?? a.startsAt;
    const bKey = b.createdAt ?? b.startsAt;
    return bKey.localeCompare(aKey);
  });
  return active[0] ?? null;
}

export function applyOverrideBonuses(
  base: PlanEntitlements,
  override: Pick<
    EntitlementOverrideInput,
    | "autoTurnBonus"
    | "frontierTurnBonus"
    | "storageBytesOverride"
    | "featureOverrides"
  >
): PlanEntitlements {
  const autoBonus = Math.max(0, override.autoTurnBonus || 0);
  const frontierBonus = Math.max(0, override.frontierTurnBonus || 0);

  const autoMonthlyTurns =
    base.autoMonthlyTurns == null
      ? null
      : base.autoMonthlyTurns + autoBonus;

  const frontierMonthlyTurns =
    base.frontierMonthlyTurns == null
      ? null
      : base.frontierMonthlyTurns + frontierBonus;

  const features = override.featureOverrides ?? {};

  return {
    ...base,
    autoMonthlyTurns,
    unlimitedAuto: autoMonthlyTurns == null,
    frontierMonthlyTurns,
    storageBytes:
      override.storageBytesOverride != null
        ? override.storageBytesOverride
        : base.storageBytes,
    attachments: features.attachments ?? base.attachments,
    byok: features.byok ?? base.byok,
    voice: features.voice ?? base.voice,
    elevatedLimits: features.elevatedLimits ?? base.elevatedLimits,
    modelFamilies: [...base.modelFamilies],
  };
}

function fromOverride(
  source: "plan_simulation" | "admin_grant",
  row: EntitlementOverrideInput
): ResolvedEntitlement {
  const base = entitlementsForPlan(row.planId);
  const entitlements = applyOverrideBonuses(base, row);
  return {
    planId: row.planId,
    source,
    isDemo: true,
    excludeFromRevenue: true,
    sourceId: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    reason: row.reason,
    entitlements,
    currentPeriodEnd: row.endsAt,
    planStatus: "active",
    cancelAtPeriodEnd: false,
    autoTurnBonus: row.autoTurnBonus,
    frontierTurnBonus: row.frontierTurnBonus,
    creditBonus: row.creditBonus,
  };
}

function fromSubscription(
  sub: SubscriptionEntitlementInput | null
): ResolvedEntitlement {
  const status = sub?.status ?? null;
  const activePaid =
    sub &&
    (status === "active" || status === "trialing" || status === "past_due") &&
    isPaidPlan(sub.planId) &&
    isLaunchPlanId(sub.planId);

  if (activePaid) {
    const planId = sub.planId as LaunchPlanId;
    return {
      planId,
      source: "subscription",
      isDemo: false,
      excludeFromRevenue: false,
      sourceId: null,
      startsAt: null,
      endsAt: null,
      reason: null,
      entitlements: entitlementsForPlan(planId),
      currentPeriodEnd: sub.currentPeriodEnd,
      planStatus: status,
      cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
      autoTurnBonus: 0,
      frontierTurnBonus: 0,
      creditBonus: 0,
    };
  }

  return {
    planId: "free",
    source: "free",
    isDemo: false,
    excludeFromRevenue: false,
    sourceId: null,
    startsAt: null,
    endsAt: null,
    reason: null,
    entitlements: entitlementsForPlan("free"),
    currentPeriodEnd: null,
    planStatus: status ?? "active",
    cancelAtPeriodEnd: false,
    autoTurnBonus: 0,
    frontierTurnBonus: 0,
    creditBonus: 0,
  };
}

/**
 * Pure entitlement resolution. Callers supply already-fetched rows;
 * this function applies priority without I/O.
 */
export function resolveEffectiveEntitlement(input: {
  now?: Date;
  simulations?: EntitlementOverrideInput[];
  grants?: EntitlementOverrideInput[];
  subscription?: SubscriptionEntitlementInput | null;
}): ResolvedEntitlement {
  const now = input.now ?? new Date();
  const simulation = pickActiveOverride(input.simulations ?? [], now);
  if (simulation) return fromOverride("plan_simulation", simulation);

  const grant = pickActiveOverride(input.grants ?? [], now);
  if (grant) return fromOverride("admin_grant", grant);

  return fromSubscription(input.subscription ?? null);
}

/**
 * Real paid revenue = Stripe subscription Lite/Pro only.
 * Simulations and admin grants never qualify.
 */
export function countsAsPaidRevenue(
  resolved: Pick<
    ResolvedEntitlement,
    "source" | "planId" | "excludeFromRevenue"
  >
): boolean {
  if (resolved.excludeFromRevenue) return false;
  if (resolved.source !== "subscription") return false;
  return isPaidPlan(resolved.planId);
}

export function shouldShowDemoSubscriptionBanner(
  resolved: Pick<ResolvedEntitlement, "isDemo" | "source">
): boolean {
  return (
    resolved.isDemo &&
    (resolved.source === "plan_simulation" ||
      resolved.source === "admin_grant")
  );
}

export function demoBannerLabel(
  resolved: Pick<ResolvedEntitlement, "source"> & { planId: string }
): string {
  const plan =
    resolved.planId.charAt(0).toUpperCase() + resolved.planId.slice(1);
  if (resolved.source === "plan_simulation") {
    return `Plan simulation active · ${plan}`;
  }
  return `Demo subscription · ${plan}`;
}
