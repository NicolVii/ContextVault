import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { grantCredits } from "@/lib/inference/credits";
import {
  createEntitlementGrant,
  type CreateEntitlementOverrideParams,
} from "@/lib/billing/admin-entitlements";
import { getPlanUsageSnapshot } from "@/lib/billing/plan-usage";
import type { LaunchPlanId } from "@/lib/billing/products";
import { isLaunchPlanId } from "@/lib/billing/entitlement-resolution";
import type { EntitlementOverrideInput } from "@/lib/billing/entitlement-resolution";

function requireReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 3) {
    throw new Error("A reason of at least 3 characters is required");
  }
  return trimmed;
}

/**
 * Reset the user's current plan usage period counters to zero.
 * Reason is mandatory and always written to admin_audit_log.
 */
export async function resetUserPlanUsage(params: {
  userId: string;
  actorUserId: string;
  reason: string;
}): Promise<{
  periodStart: string;
  periodEnd: string;
  previous: {
    autoTurns: number;
    frontierTurns: number;
    autoCredits: number;
    frontierCredits: number;
  };
}> {
  const reason = requireReason(params.reason);
  const snap = await getPlanUsageSnapshot(params.userId);
  const admin = createSupabaseAdminClient();

  const previous = {
    autoTurns: snap.autoTurns,
    frontierTurns: snap.frontierTurns,
    autoCredits: snap.autoCredits,
    frontierCredits: snap.frontierCredits,
  };

  const { error } = await admin.from("plan_usage_periods").upsert(
    {
      user_id: params.userId,
      plan_id: snap.planId,
      period_start: snap.periodStart,
      period_end: snap.periodEnd,
      auto_turns: 0,
      frontier_turns: 0,
      auto_credits: 0,
      frontier_credits: 0,
    },
    { onConflict: "user_id,period_start" }
  );
  if (error) throw error;

  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.usage.reset",
    targetType: "user",
    targetId: params.userId,
    metadata: {
      userId: params.userId,
      reason,
      periodStart: snap.periodStart,
      periodEnd: snap.periodEnd,
      previous,
    },
  });

  return {
    periodStart: snap.periodStart,
    periodEnd: snap.periodEnd,
    previous,
  };
}

async function grantTurnBonus(params: {
  userId: string;
  actorUserId: string;
  reason: string;
  kind: "auto" | "frontier";
  amount: number;
  endsAt?: string | null;
}): Promise<EntitlementOverrideInput> {
  const reason = requireReason(params.reason);
  const amount = Math.floor(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Bonus amount must be a positive integer");
  }

  const snap = await getPlanUsageSnapshot(params.userId);
  const planId: LaunchPlanId = isLaunchPlanId(snap.planId)
    ? snap.planId
    : "free";

  const grantParams: CreateEntitlementOverrideParams = {
    userId: params.userId,
    planId,
    endsAt: params.endsAt ?? null,
    autoTurnBonus: params.kind === "auto" ? amount : 0,
    frontierTurnBonus: params.kind === "frontier" ? amount : 0,
    creditBonus: 0,
    reason: `${params.kind === "auto" ? "Auto" : "Frontier"} bonus: ${reason}`,
    createdBy: params.actorUserId,
  };

  const grant = await createEntitlementGrant(grantParams);

  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action:
      params.kind === "auto"
        ? "admin.bonus.auto"
        : "admin.bonus.frontier",
    targetType: "user",
    targetId: params.userId,
    metadata: {
      userId: params.userId,
      amount,
      planId,
      grantId: grant.id,
      reason,
      endsAt: params.endsAt ?? null,
    },
  });

  return grant;
}

/** Temporary Auto turn bonus via entitlement grant (audited). */
export async function grantAutoBonus(params: {
  userId: string;
  actorUserId: string;
  amount: number;
  reason: string;
  endsAt?: string | null;
}): Promise<EntitlementOverrideInput> {
  return grantTurnBonus({ ...params, kind: "auto" });
}

/** Temporary Frontier turn bonus via entitlement grant (audited). */
export async function grantFrontierBonus(params: {
  userId: string;
  actorUserId: string;
  amount: number;
  reason: string;
  endsAt?: string | null;
}): Promise<EntitlementOverrideInput> {
  return grantTurnBonus({ ...params, kind: "frontier" });
}

/** Direct credit wallet bonus (audited). */
export async function grantCreditBonus(params: {
  userId: string;
  actorUserId: string;
  amount: number;
  reason: string;
}): Promise<{ balance: number }> {
  const reason = requireReason(params.reason);
  const amount = Math.floor(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Credit bonus must be a positive integer");
  }

  const balance = await grantCredits(
    params.userId,
    amount,
    "admin_credit_bonus"
  );

  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.bonus.credit",
    targetType: "user",
    targetId: params.userId,
    metadata: {
      userId: params.userId,
      amount,
      balanceAfter: balance,
      reason,
    },
  });

  return { balance };
}
