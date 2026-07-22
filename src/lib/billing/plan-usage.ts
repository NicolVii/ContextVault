import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { entitlementsForPlan, type PlanEntitlements } from "./entitlements";
import type { UsageIntensity } from "./usage-intensity";
import { recordBillingTelemetry } from "./telemetry";
import { applyGraceExpiryIfNeeded } from "./grace";
import {
  listEntitlementGrantsForUser,
  listPlanSimulationsForUser,
} from "./admin-entitlements";
import {
  countsAsPaidRevenue,
  resolveEffectiveEntitlement,
  shouldShowDemoSubscriptionBanner,
  type EntitlementSource,
  type ResolvedEntitlement,
} from "./entitlement-resolution";
import { ensurePlanConfigLoaded } from "./plan-config-loader";
import { listActivePromotionBonusesForUser } from "./promotions";

export class PlanUsageBlockedError extends Error {
  readonly code:
    | "auto_exhausted"
    | "frontier_exhausted"
    | "frontier_blocked"
    | "fair_use"
    | "per_turn_cap"
    | "restricted";

  constructor(
    code: PlanUsageBlockedError["code"],
    message: string
  ) {
    super(message);
    this.name = "PlanUsageBlockedError";
    this.code = code;
  }
}

export interface PlanUsageSnapshot {
  planId: string;
  periodStart: string;
  periodEnd: string;
  autoTurns: number;
  frontierTurns: number;
  autoCredits: number;
  frontierCredits: number;
  entitlements: PlanEntitlements;
  autoRemaining: number | null;
  frontierRemaining: number | null;
  frontierHeavy: boolean;
  inferenceRestricted: boolean;
  gracePeriodEndsAt: string | null;
  currentPeriodEnd: string | null;
  planStatus: string | null;
  cancelAtPeriodEnd: boolean;
  /** Where the effective plan came from. */
  entitlementSource: EntitlementSource;
  /** True for plan simulations and admin entitlement grants. */
  isDemo: boolean;
  /** Demo / grant rows never contribute to paid revenue. */
  excludeFromRevenue: boolean;
  showDemoSubscriptionBanner: boolean;
  entitlementReason: string | null;
  entitlementEndsAt: string | null;
  entitlementSourceId: string | null;
}

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

async function loadResolvedEntitlement(
  userId: string
): Promise<ResolvedEntitlement> {
  const admin = createSupabaseAdminClient();
  // Warm DB-backed plan catalog (TTL cache); sync entitlement helpers read it.
  const [, simulations, grants, promotionBonuses, subRes] = await Promise.all([
    ensurePlanConfigLoaded(),
    listPlanSimulationsForUser(userId),
    listEntitlementGrantsForUser(userId),
    listActivePromotionBonusesForUser(userId),
    admin
      .from("subscriptions")
      .select("plan_id, status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const sub = subRes.data;
  return resolveEffectiveEntitlement({
    simulations,
    grants,
    promotionBonuses,
    subscription: sub
      ? {
          planId: (sub.plan_id as string) ?? "free",
          status: (sub.status as string | null) ?? null,
          currentPeriodEnd: (sub.current_period_end as string | null) ?? null,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        }
      : null,
  });
}

/**
 * Resolve usage period using effective entitlement priority.
 * Stripe period is used only for real paid subscriptions; Free and
 * demo/grant overrides use calendar months.
 */
export async function resolveUsagePeriod(userId: string): Promise<{
  planId: string;
  periodStart: Date;
  periodEnd: Date;
  currentPeriodEnd: string | null;
  planStatus: string | null;
  cancelAtPeriodEnd: boolean;
  resolved: ResolvedEntitlement;
}> {
  const resolved = await loadResolvedEntitlement(userId);

  if (
    resolved.source === "subscription" &&
    countsAsPaidRevenue(resolved) &&
    resolved.currentPeriodEnd
  ) {
    const periodEnd = new Date(resolved.currentPeriodEnd);
    const periodStart = new Date(periodEnd);
    periodStart.setUTCMonth(periodStart.getUTCMonth() - 1);
    return {
      planId: resolved.planId,
      periodStart,
      periodEnd,
      currentPeriodEnd: resolved.currentPeriodEnd,
      planStatus: resolved.planStatus,
      cancelAtPeriodEnd: resolved.cancelAtPeriodEnd,
      resolved,
    };
  }

  return {
    planId: resolved.planId,
    periodStart: startOfUtcMonth(),
    periodEnd: endOfUtcMonth(),
    currentPeriodEnd: resolved.currentPeriodEnd,
    planStatus: resolved.planStatus,
    cancelAtPeriodEnd: resolved.cancelAtPeriodEnd,
    resolved,
  };
}

export async function getBillingRestriction(userId: string): Promise<{
  inferenceRestricted: boolean;
  gracePeriodEndsAt: string | null;
}> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("billing_settings")
    .select("inference_restricted, grace_period_ends_at")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    inferenceRestricted: Boolean(data?.inference_restricted),
    gracePeriodEndsAt: (data?.grace_period_ends_at as string | null) ?? null,
  };
}

function freeSnapshotFallback(userIdIgnored?: string): PlanUsageSnapshot {
  void userIdIgnored;
  const ents = entitlementsForPlan("free");
  const periodStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
  );
  const periodEnd = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)
  );
  return {
    planId: "free",
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    autoTurns: 0,
    frontierTurns: 0,
    autoCredits: 0,
    frontierCredits: 0,
    entitlements: ents,
    autoRemaining: ents.autoMonthlyTurns,
    frontierRemaining: 0,
    frontierHeavy: false,
    inferenceRestricted: false,
    gracePeriodEndsAt: null,
    currentPeriodEnd: null,
    planStatus: "active",
    cancelAtPeriodEnd: false,
    entitlementSource: "free",
    isDemo: false,
    excludeFromRevenue: false,
    showDemoSubscriptionBanner: false,
    entitlementReason: null,
    entitlementEndsAt: null,
    entitlementSourceId: null,
  };
}

function snapshotMetaFromResolved(resolved: ResolvedEntitlement) {
  return {
    entitlementSource: resolved.source,
    isDemo: resolved.isDemo,
    excludeFromRevenue: resolved.excludeFromRevenue,
    showDemoSubscriptionBanner: shouldShowDemoSubscriptionBanner(resolved),
    entitlementReason: resolved.reason,
    entitlementEndsAt: resolved.endsAt,
    entitlementSourceId: resolved.sourceId,
  };
}

export async function getPlanUsageSnapshot(userId: string): Promise<PlanUsageSnapshot> {
  try {
    const admin = createSupabaseAdminClient();
    const period = await resolveUsagePeriod(userId);
    const ents = period.resolved.entitlements;
    await applyGraceExpiryIfNeeded(userId);
    const restriction = await getBillingRestriction(userId);

    const { data: row } = await admin
      .from("plan_usage_periods")
      .select("auto_turns, frontier_turns, auto_credits, frontier_credits")
      .eq("user_id", userId)
      .eq("period_start", period.periodStart.toISOString())
      .maybeSingle();

    const autoTurns = (row?.auto_turns as number | undefined) ?? 0;
    const frontierTurns = (row?.frontier_turns as number | undefined) ?? 0;
    const autoCredits = (row?.auto_credits as number | undefined) ?? 0;
    const frontierCredits = (row?.frontier_credits as number | undefined) ?? 0;

    const autoRemaining =
      ents.autoMonthlyTurns == null
        ? null
        : Math.max(0, ents.autoMonthlyTurns - autoTurns);
    const frontierRemaining =
      ents.frontierMonthlyTurns == null
        ? null
        : Math.max(0, ents.frontierMonthlyTurns - frontierTurns);

    const soft = ents.frontierSoftCreditCap;
    const frontierHeavy =
      soft != null && soft > 0 && frontierCredits / soft >= ents.frontierHeavyRatio;

    return {
      planId: period.planId,
      periodStart: period.periodStart.toISOString(),
      periodEnd: period.periodEnd.toISOString(),
      autoTurns,
      frontierTurns,
      autoCredits,
      frontierCredits,
      entitlements: ents,
      autoRemaining,
      frontierRemaining,
      frontierHeavy,
      inferenceRestricted: restriction.inferenceRestricted,
      gracePeriodEndsAt: restriction.gracePeriodEndsAt,
      currentPeriodEnd: period.currentPeriodEnd,
      planStatus: period.planStatus ?? "active",
      cancelAtPeriodEnd: period.cancelAtPeriodEnd,
      ...snapshotMetaFromResolved(period.resolved),
    };
  } catch {
    // Missing migration / transient DB errors must not blank Vault Plan & Usage.
    return freeSnapshotFallback(userId);
  }
}

export async function getFoundingOfferState(
  userId: string,
  /**
   * Optional precomputed snapshot. Callers that already paid for
   * {@link getPlanUsageSnapshot} should pass it so we do not run the
   * expensive entitlement/usage path twice.
   */
  snap?: PlanUsageSnapshot
): Promise<{
  showFoundingOffer: boolean;
  foundingOfferDismissed: boolean;
}> {
  try {
    const admin = createSupabaseAdminClient();
    const planSnap = snap ?? (await getPlanUsageSnapshot(userId));
    const { data } = await admin
      .from("billing_settings")
      .select("founding_offer_dismissed")
      .eq("user_id", userId)
      .maybeSingle();
    const dismissed = Boolean(data?.founding_offer_dismissed);
    return {
      foundingOfferDismissed: dismissed,
      // Never pitch Founding Pro while a demo grant/simulation is active.
      showFoundingOffer:
        planSnap.planId === "free" && !dismissed && !planSnap.isDemo,
    };
  } catch {
    return { showFoundingOffer: false, foundingOfferDismissed: false };
  }
}

export async function dismissFoundingOffer(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("billing_settings").upsert(
    {
      user_id: userId,
      founding_offer_dismissed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

/**
 * Pure plan-limit gate used by {@link assertPlanAllowsTurn}.
 * Exported for unit coverage of Free/Lite/Pro ceilings without a DB.
 */
export function evaluatePlanTurnGate(input: {
  inferenceRestricted: boolean;
  entitlements: PlanEntitlements;
  autoRemaining: number | null;
  frontierRemaining: number | null;
  autoCredits: number;
  frontierCredits: number;
  intensity: UsageIntensity;
  estimatedCredits: number;
}): void {
  if (input.inferenceRestricted) {
    throw new PlanUsageBlockedError(
      "restricted",
      "AI usage is paused due to a billing problem. Update billing to continue."
    );
  }

  const ents = input.entitlements;

  if (input.intensity === "frontier") {
    if (ents.frontierMonthlyTurns === 0) {
      throw new PlanUsageBlockedError(
        "frontier_blocked",
        "Frontier models are available on Lite and Pro."
      );
    }
    if (
      ents.maxFrontierCreditsPerTurn > 0 &&
      input.estimatedCredits > ents.maxFrontierCreditsPerTurn
    ) {
      throw new PlanUsageBlockedError(
        "per_turn_cap",
        "This request is too large for your plan. Try a shorter conversation or upgrade."
      );
    }
    if (
      ents.frontierMonthlyTurns != null &&
      (input.frontierRemaining ?? 0) <= 0
    ) {
      throw new PlanUsageBlockedError(
        "frontier_exhausted",
        "No Frontier conversations left this period. Auto still works, or upgrade to Pro."
      );
    }
    if (
      ents.frontierSoftCreditCap != null &&
      input.frontierCredits + input.estimatedCredits > ents.frontierSoftCreditCap
    ) {
      throw new PlanUsageBlockedError(
        "fair_use",
        "You’ve used Frontier heavily this period. Try Auto, or try again next period."
      );
    }
  } else {
    if (ents.autoMonthlyTurns != null && (input.autoRemaining ?? 0) <= 0) {
      throw new PlanUsageBlockedError(
        "auto_exhausted",
        "No Auto conversations left this month. Upgrade to Lite or Pro to continue."
      );
    }
    if (
      input.autoCredits + input.estimatedCredits >
      ents.autoFairUsePeriodCredits
    ) {
      throw new PlanUsageBlockedError(
        "fair_use",
        "Auto usage paused under fair use this period. Please slow down or contact support."
      );
    }
  }
}

export async function assertPlanAllowsTurn(input: {
  userId: string;
  intensity: UsageIntensity;
  estimatedCredits: number;
}): Promise<PlanUsageSnapshot> {
  const snap = await getPlanUsageSnapshot(input.userId);
  evaluatePlanTurnGate({
    inferenceRestricted: snap.inferenceRestricted,
    entitlements: snap.entitlements,
    autoRemaining: snap.autoRemaining,
    frontierRemaining: snap.frontierRemaining,
    autoCredits: snap.autoCredits,
    frontierCredits: snap.frontierCredits,
    intensity: input.intensity,
    estimatedCredits: input.estimatedCredits,
  });
  return snap;
}

export async function recordPlanTurn(input: {
  userId: string;
  planId: string;
  intensity: UsageIntensity;
  credits: number;
  modelId: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const period = await resolveUsagePeriod(input.userId);
  const ents = period.resolved.entitlements;

  const { data, error } = await admin.rpc("record_plan_usage_turn", {
    p_user_id: input.userId,
    p_plan_id: period.planId,
    p_period_start: period.periodStart.toISOString(),
    p_period_end: period.periodEnd.toISOString(),
    p_intensity: input.intensity,
    p_credits: input.credits,
    p_max_auto_turns: ents.autoMonthlyTurns,
    p_max_frontier_turns: ents.frontierMonthlyTurns,
    p_max_auto_credits: ents.autoFairUsePeriodCredits,
    p_max_frontier_credits: ents.frontierSoftCreditCap,
    p_max_credits_per_turn:
      input.intensity === "frontier" ? ents.maxFrontierCreditsPerTurn : 0,
  });

  if (error) throw error;
  if (data === false) {
    throw new PlanUsageBlockedError(
      input.intensity === "frontier" ? "frontier_exhausted" : "auto_exhausted",
      "Usage limit reached for this period."
    );
  }

  await recordBillingTelemetry({
    userId: input.userId,
    eventName: "inference_turn",
    planId: period.planId,
    intensity: input.intensity,
    modelId: input.modelId,
    credits: input.credits,
    meta: {
      entitlementSource: period.resolved.source,
      excludeFromRevenue: period.resolved.excludeFromRevenue,
      isDemo: period.resolved.isDemo,
      countsAsPaidRevenue: countsAsPaidRevenue(period.resolved),
    },
  });
}
