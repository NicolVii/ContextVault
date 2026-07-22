import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { grantCredits } from "@/lib/inference/credits";
import {
  isLaunchPlanId,
  parseFeatureOverrides,
  type EntitlementOverrideInput,
  type FeatureOverrides,
} from "./entitlement-resolution";
import type { LaunchPlanId } from "./products";

export interface CreateEntitlementOverrideParams {
  userId: string;
  planId: LaunchPlanId;
  startsAt?: string | Date;
  endsAt?: string | Date | null;
  autoTurnBonus?: number;
  frontierTurnBonus?: number;
  creditBonus?: number;
  storageBytesOverride?: number | null;
  featureOverrides?: FeatureOverrides;
  reason?: string | null;
  createdBy: string;
}

type OverrideKind = "grant" | "simulation";

function tableFor(kind: OverrideKind): string {
  return kind === "grant"
    ? "admin_entitlement_grants"
    : "admin_plan_simulations";
}

function auditAction(kind: OverrideKind, verb: "create" | "revoke"): string {
  return kind === "grant"
    ? `admin.entitlement_grant.${verb}`
    : `admin.plan_simulation.${verb}`;
}

function toIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapRow(row: Record<string, unknown>): EntitlementOverrideInput {
  const planId = String(row.plan_id ?? "free");
  return {
    id: String(row.id),
    planId: isLaunchPlanId(planId) ? planId : "free",
    startsAt: String(row.starts_at),
    endsAt: (row.ends_at as string | null) ?? null,
    autoTurnBonus: Number(row.auto_turn_bonus ?? 0),
    frontierTurnBonus: Number(row.frontier_turn_bonus ?? 0),
    creditBonus: Number(row.credit_bonus ?? 0),
    storageBytesOverride:
      row.storage_bytes_override == null
        ? null
        : Number(row.storage_bytes_override),
    featureOverrides: parseFeatureOverrides(row.feature_overrides),
    reason: (row.reason as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    excludeFromRevenue: row.exclude_from_revenue !== false,
    createdAt: (row.created_at as string | undefined) ?? undefined,
  };
}

async function listOverridesForUser(
  kind: OverrideKind,
  userId: string
): Promise<EntitlementOverrideInput[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from(tableFor(kind))
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function listEntitlementGrantsForUser(
  userId: string
): Promise<EntitlementOverrideInput[]> {
  return listOverridesForUser("grant", userId);
}

export async function listPlanSimulationsForUser(
  userId: string
): Promise<EntitlementOverrideInput[]> {
  return listOverridesForUser("simulation", userId);
}

async function createOverride(
  kind: OverrideKind,
  params: CreateEntitlementOverrideParams
): Promise<EntitlementOverrideInput> {
  if (!isLaunchPlanId(params.planId)) {
    throw new Error("planId must be free, lite, or pro");
  }

  const startsAt = toIso(params.startsAt ?? new Date())!;
  const endsAt = toIso(params.endsAt ?? null);
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new Error("endsAt must be after startsAt");
  }

  const creditBonus = Math.max(0, Math.floor(params.creditBonus ?? 0));
  const autoTurnBonus = Math.max(0, Math.floor(params.autoTurnBonus ?? 0));
  const frontierTurnBonus = Math.max(
    0,
    Math.floor(params.frontierTurnBonus ?? 0)
  );

  const admin = createSupabaseAdminClient();
  const insert = {
    user_id: params.userId,
    plan_id: params.planId,
    starts_at: startsAt,
    ends_at: endsAt,
    auto_turn_bonus: autoTurnBonus,
    frontier_turn_bonus: frontierTurnBonus,
    credit_bonus: creditBonus,
    storage_bytes_override: params.storageBytesOverride ?? null,
    feature_overrides: params.featureOverrides ?? {},
    reason: params.reason ?? null,
    created_by: params.createdBy,
    exclude_from_revenue: true,
  };

  const { data, error } = await admin
    .from(tableFor(kind))
    .insert(insert)
    .select("*")
    .single();
  if (error) throw error;

  const mapped = mapRow(data as Record<string, unknown>);

  if (creditBonus > 0) {
    await grantCredits(
      params.userId,
      creditBonus,
      kind === "grant"
        ? "admin_entitlement_credit_bonus"
        : "admin_plan_simulation_credit_bonus"
    );
    await admin
      .from(tableFor(kind))
      .update({ credit_bonus_applied_at: new Date().toISOString() })
      .eq("id", mapped.id);
  }

  await recordAdminAudit({
    actorUserId: params.createdBy,
    action: auditAction(kind, "create"),
    targetType: tableFor(kind),
    targetId: mapped.id,
    metadata: {
      userId: params.userId,
      planId: params.planId,
      startsAt,
      endsAt,
      autoTurnBonus,
      frontierTurnBonus,
      creditBonus,
      storageBytesOverride: params.storageBytesOverride ?? null,
      featureOverrides: params.featureOverrides ?? {},
      reason: params.reason ?? null,
      excludeFromRevenue: true,
    },
  });

  return mapped;
}

export async function createEntitlementGrant(
  params: CreateEntitlementOverrideParams
): Promise<EntitlementOverrideInput> {
  return createOverride("grant", params);
}

export async function createPlanSimulation(
  params: CreateEntitlementOverrideParams
): Promise<EntitlementOverrideInput> {
  return createOverride("simulation", params);
}

async function revokeOverride(
  kind: OverrideKind,
  id: string,
  actorUserId: string,
  reason?: string | null
): Promise<EntitlementOverrideInput | null> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from(tableFor(kind))
    .update({ revoked_at: now })
    .eq("id", id)
    .is("revoked_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const mapped = mapRow(data as Record<string, unknown>);
  await recordAdminAudit({
    actorUserId,
    action: auditAction(kind, "revoke"),
    targetType: tableFor(kind),
    targetId: id,
    metadata: {
      userId: (data as { user_id?: string }).user_id ?? null,
      planId: mapped.planId,
      reason: reason ?? null,
      excludeFromRevenue: true,
    },
  });
  return mapped;
}

export async function revokeEntitlementGrant(
  id: string,
  actorUserId: string,
  reason?: string | null
): Promise<EntitlementOverrideInput | null> {
  return revokeOverride("grant", id, actorUserId, reason);
}

export async function endPlanSimulation(
  id: string,
  actorUserId: string,
  reason?: string | null
): Promise<EntitlementOverrideInput | null> {
  return revokeOverride("simulation", id, actorUserId, reason);
}
