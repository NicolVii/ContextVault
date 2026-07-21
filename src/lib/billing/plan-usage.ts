import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { entitlementsForPlan, type PlanEntitlements } from "./entitlements";
import type { UsageIntensity } from "./usage-intensity";
import { recordBillingTelemetry } from "./telemetry";
import { applyGraceExpiryIfNeeded } from "./grace";

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
}

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/** Free uses calendar months; paid plans prefer Stripe period when available. */
export async function resolveUsagePeriod(userId: string): Promise<{
  planId: string;
  periodStart: Date;
  periodEnd: Date;
  currentPeriodEnd: string | null;
  planStatus: string | null;
  cancelAtPeriodEnd: boolean;
}> {
  const admin = createSupabaseAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan_id, status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  const status = (sub?.status as string | null) ?? null;
  const activePaid =
    sub &&
    (status === "active" || status === "trialing" || status === "past_due") &&
    (sub.plan_id === "lite" || sub.plan_id === "pro");

  if (activePaid && sub.current_period_end) {
    const periodEnd = new Date(sub.current_period_end as string);
    // Approximate period start as one month before end when Stripe start unavailable.
    const periodStart = new Date(periodEnd);
    periodStart.setUTCMonth(periodStart.getUTCMonth() - 1);
    return {
      planId: sub.plan_id as string,
      periodStart,
      periodEnd,
      currentPeriodEnd: sub.current_period_end as string,
      planStatus: status,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    };
  }

  return {
    planId: "free",
    periodStart: startOfUtcMonth(),
    periodEnd: endOfUtcMonth(),
    currentPeriodEnd: null,
    planStatus: status,
    cancelAtPeriodEnd: false,
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

export async function getPlanUsageSnapshot(userId: string): Promise<PlanUsageSnapshot> {
  const admin = createSupabaseAdminClient();
  const period = await resolveUsagePeriod(userId);
  const ents = entitlementsForPlan(period.planId);
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
    ents.autoMonthlyTurns == null ? null : Math.max(0, ents.autoMonthlyTurns - autoTurns);
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
    planStatus: period.planStatus,
    cancelAtPeriodEnd: period.cancelAtPeriodEnd,
  };
}

export async function assertPlanAllowsTurn(input: {
  userId: string;
  intensity: UsageIntensity;
  estimatedCredits: number;
}): Promise<PlanUsageSnapshot> {
  const snap = await getPlanUsageSnapshot(input.userId);
  if (snap.inferenceRestricted) {
    throw new PlanUsageBlockedError(
      "restricted",
      "AI usage is paused due to a billing problem. Update billing to continue."
    );
  }

  const ents = snap.entitlements;

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
    if (ents.frontierMonthlyTurns != null && (snap.frontierRemaining ?? 0) <= 0) {
      throw new PlanUsageBlockedError(
        "frontier_exhausted",
        "No Frontier conversations left this period. Auto still works, or upgrade to Pro."
      );
    }
    if (
      ents.frontierSoftCreditCap != null &&
      snap.frontierCredits + input.estimatedCredits > ents.frontierSoftCreditCap
    ) {
      throw new PlanUsageBlockedError(
        "fair_use",
        "You’ve used Frontier heavily this period. Try Auto, or try again next period."
      );
    }
  } else {
    if (ents.autoMonthlyTurns != null && (snap.autoRemaining ?? 0) <= 0) {
      throw new PlanUsageBlockedError(
        "auto_exhausted",
        "No Auto conversations left this month. Upgrade to Lite or Pro to continue."
      );
    }
    if (snap.autoCredits + input.estimatedCredits > ents.autoFairUsePeriodCredits) {
      throw new PlanUsageBlockedError(
        "fair_use",
        "Auto usage paused under fair use this period. Please slow down or contact support."
      );
    }
  }

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
  const ents = entitlementsForPlan(input.planId || period.planId);

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
  });
}
