/**
 * Admin Plan Editor — publish / rollback versioned plan configuration and
 * manage temporary campaign entitlement overlays.
 *
 * Every mutation requires a reason, validates config, writes a plan_versions
 * row (except campaign create/revoke), and appends admin_audit_log.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import {
  ALL_MODEL_FAMILIES,
  PLAN_ENTITLEMENTS,
  SUBSCRIPTION_PLANS,
  type LaunchPlanId,
  type ModelFamilyId,
  type PlanEntitlements,
  type SubscriptionPlan,
} from "./plan-defaults";
import {
  campaignEntitlementOverridesSchema,
  clearPlanConfigCache,
  isLaunchPlanId,
  planEntitlementsSchema,
  subscriptionPlanSchema,
  type CampaignEntitlementOverrides,
} from "./plan-config";

export type PlanVersionStatus = "draft" | "active" | "retired";

export interface PlanProductInput {
  label: string;
  purpose: string;
  amountEurCentsMonthly: number;
  amountEurCentsAnnual?: number | null;
  foundingEurCentsMonthly?: number | null;
  stripePriceEnvMonthly?: string | null;
  stripePriceEnvAnnual?: string | null;
  features: string[];
  public: boolean;
}

export interface PlanEntitlementInput {
  autoMonthlyTurns: number | null;
  unlimitedAuto: boolean;
  autoFairUseDailyCredits: number;
  autoFairUsePeriodCredits: number;
  frontierMonthlyTurns: number | null;
  maxFrontierCreditsPerTurn: number;
  frontierSoftCreditCap: number | null;
  frontierHeavyRatio: number;
  attachments: boolean;
  storageBytes: number;
  byok: boolean;
  voice: boolean;
  elevatedLimits: boolean;
  modelFamilies: ModelFamilyId[];
}

export interface PlanVersionSummary {
  id: string;
  planId: LaunchPlanId;
  version: number;
  status: PlanVersionStatus;
  effectiveFrom: string;
  changeReason: string | null;
  createdBy: string | null;
  createdAt: string;
  supersededVersionId: string | null;
  product: PlanProductInput;
  entitlements: PlanEntitlements;
}

export interface PlanCampaignSummary {
  id: string;
  planId: LaunchPlanId;
  name: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  entitlementOverrides: CampaignEntitlementOverrides;
  createdBy: string | null;
  revokedAt: string | null;
  createdAt: string;
  active: boolean;
}

export interface AdminPlanDetail {
  planId: LaunchPlanId;
  product: PlanProductInput & { active: boolean; sortOrder: number };
  activeVersion: PlanVersionSummary | null;
  versions: PlanVersionSummary[];
  campaigns: PlanCampaignSummary[];
  modelFamilyOptions: ModelFamilyId[];
}

function requireReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 3) {
    throw new Error("A reason of at least 3 characters is required");
  }
  return trimmed;
}

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function productFromPlan(plan: SubscriptionPlan): PlanProductInput {
  return {
    label: plan.label,
    purpose: plan.purpose,
    amountEurCentsMonthly: plan.amountEurCentsMonthly,
    amountEurCentsAnnual: plan.amountEurCentsAnnual ?? null,
    foundingEurCentsMonthly: plan.foundingEurCentsMonthly ?? null,
    stripePriceEnvMonthly: plan.stripePriceEnvMonthly ?? null,
    stripePriceEnvAnnual: plan.stripePriceEnvAnnual ?? null,
    features: [...plan.features],
    public: plan.public,
  };
}

function validateProduct(
  planId: LaunchPlanId,
  product: PlanProductInput
): PlanProductInput {
  const candidate = {
    id: planId,
    label: product.label,
    purpose: product.purpose,
    amountEurCentsMonthly: product.amountEurCentsMonthly,
    ...(product.amountEurCentsAnnual != null
      ? { amountEurCentsAnnual: product.amountEurCentsAnnual }
      : {}),
    ...(product.foundingEurCentsMonthly != null
      ? { foundingEurCentsMonthly: product.foundingEurCentsMonthly }
      : {}),
    ...(product.stripePriceEnvMonthly
      ? { stripePriceEnvMonthly: product.stripePriceEnvMonthly }
      : {}),
    ...(product.stripePriceEnvAnnual
      ? { stripePriceEnvAnnual: product.stripePriceEnvAnnual }
      : {}),
    features: product.features,
    public: product.public,
  };
  const parsed = subscriptionPlanSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      `Invalid plan product: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  return {
    label: parsed.data.label,
    purpose: parsed.data.purpose,
    amountEurCentsMonthly: parsed.data.amountEurCentsMonthly,
    amountEurCentsAnnual: parsed.data.amountEurCentsAnnual ?? null,
    foundingEurCentsMonthly: parsed.data.foundingEurCentsMonthly ?? null,
    stripePriceEnvMonthly: parsed.data.stripePriceEnvMonthly ?? null,
    stripePriceEnvAnnual: parsed.data.stripePriceEnvAnnual ?? null,
    features: parsed.data.features,
    public: parsed.data.public,
  };
}

function validateEntitlements(
  planId: LaunchPlanId,
  entitlements: PlanEntitlementInput
): PlanEntitlements {
  const parsed = planEntitlementsSchema.safeParse({
    planId,
    ...entitlements,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid plan entitlements: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  return parsed.data;
}

function productSnapshotJson(product: PlanProductInput): Record<string, unknown> {
  return {
    label: product.label,
    purpose: product.purpose,
    amountEurCentsMonthly: product.amountEurCentsMonthly,
    amountEurCentsAnnual: product.amountEurCentsAnnual ?? null,
    foundingEurCentsMonthly: product.foundingEurCentsMonthly ?? null,
    stripePriceEnvMonthly: product.stripePriceEnvMonthly ?? null,
    stripePriceEnvAnnual: product.stripePriceEnvAnnual ?? null,
    features: product.features,
    public: product.public,
  };
}

function parseProductSnapshot(
  raw: unknown,
  fallbackPlanId: LaunchPlanId
): PlanProductInput {
  const fallback = productFromPlan(
    SUBSCRIPTION_PLANS.find((p) => p.id === fallbackPlanId)!
  );
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const obj = raw as Record<string, unknown>;
  try {
    return validateProduct(fallbackPlanId, {
      label: typeof obj.label === "string" ? obj.label : fallback.label,
      purpose: typeof obj.purpose === "string" ? obj.purpose : fallback.purpose,
      amountEurCentsMonthly:
        typeof obj.amountEurCentsMonthly === "number"
          ? obj.amountEurCentsMonthly
          : fallback.amountEurCentsMonthly,
      amountEurCentsAnnual:
        obj.amountEurCentsAnnual == null
          ? null
          : Number(obj.amountEurCentsAnnual),
      foundingEurCentsMonthly:
        obj.foundingEurCentsMonthly == null
          ? null
          : Number(obj.foundingEurCentsMonthly),
      stripePriceEnvMonthly:
        typeof obj.stripePriceEnvMonthly === "string"
          ? obj.stripePriceEnvMonthly
          : null,
      stripePriceEnvAnnual:
        typeof obj.stripePriceEnvAnnual === "string"
          ? obj.stripePriceEnvAnnual
          : null,
      features: Array.isArray(obj.features)
        ? (obj.features as string[])
        : fallback.features,
      public: typeof obj.public === "boolean" ? obj.public : fallback.public,
    });
  } catch {
    return fallback;
  }
}

function mapEntitlementRow(
  planId: LaunchPlanId,
  row: Record<string, unknown>
): PlanEntitlements {
  const families = Array.isArray(row.model_families)
    ? (row.model_families as string[]).filter((f): f is ModelFamilyId =>
        (ALL_MODEL_FAMILIES as readonly string[]).includes(f)
      )
    : [...PLAN_ENTITLEMENTS[planId].modelFamilies];

  const candidate: PlanEntitlementInput = {
    autoMonthlyTurns: (row.auto_monthly_turns as number | null) ?? null,
    unlimitedAuto: Boolean(row.unlimited_auto),
    autoFairUseDailyCredits: Number(row.auto_fair_use_daily_credits ?? 0),
    autoFairUsePeriodCredits: Number(row.auto_fair_use_period_credits ?? 0),
    frontierMonthlyTurns: (row.frontier_monthly_turns as number | null) ?? null,
    maxFrontierCreditsPerTurn: Number(row.max_frontier_credits_per_turn ?? 0),
    frontierSoftCreditCap:
      row.frontier_soft_credit_cap == null
        ? null
        : Number(row.frontier_soft_credit_cap),
    frontierHeavyRatio: Number(row.frontier_heavy_ratio ?? 0.8),
    attachments: Boolean(row.attachments),
    storageBytes: Number(row.storage_bytes ?? 0),
    byok: Boolean(row.byok),
    voice: Boolean(row.voice),
    elevatedLimits: Boolean(row.elevated_limits),
    modelFamilies: families,
  };

  try {
    return validateEntitlements(planId, candidate);
  } catch {
    return {
      ...PLAN_ENTITLEMENTS[planId],
      modelFamilies: [...PLAN_ENTITLEMENTS[planId].modelFamilies],
    };
  }
}

function isCampaignActive(
  row: Pick<PlanCampaignSummary, "startsAt" | "endsAt" | "revokedAt">,
  now: Date = new Date()
): boolean {
  if (row.revokedAt) return false;
  const start = new Date(row.startsAt).getTime();
  const end = new Date(row.endsAt).getTime();
  const t = now.getTime();
  return start <= t && t < end;
}

function mapCampaignRow(row: Record<string, unknown>): PlanCampaignSummary {
  const planIdRaw = String(row.plan_id ?? "free");
  const planId: LaunchPlanId = isLaunchPlanId(planIdRaw) ? planIdRaw : "free";
  const overridesParsed = campaignEntitlementOverridesSchema.safeParse(
    row.entitlement_overrides ?? {}
  );
  const summary: PlanCampaignSummary = {
    id: String(row.id),
    planId,
    name: String(row.name ?? ""),
    reason: String(row.reason ?? ""),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    entitlementOverrides: overridesParsed.success ? overridesParsed.data : {},
    createdBy: (row.created_by as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    createdAt: String(row.created_at),
    active: false,
  };
  summary.active = isCampaignActive(summary);
  return summary;
}

async function loadVersionSummaries(
  planId: LaunchPlanId
): Promise<PlanVersionSummary[]> {
  const admin = createSupabaseAdminClient();
  const { data: versions, error } = await admin
    .from("plan_versions")
    .select(
      "id, plan_id, version, status, effective_from, change_reason, created_by, created_at, superseded_version_id, product_snapshot"
    )
    .eq("plan_id", planId)
    .order("version", { ascending: false });
  if (error) throw error;

  const ids = (versions ?? []).map((v) => v.id as string);
  const entsByVersion = new Map<string, PlanEntitlements>();
  if (ids.length > 0) {
    const { data: ents, error: entsError } = await admin
      .from("plan_entitlements")
      .select("*")
      .in("plan_version_id", ids);
    if (entsError) throw entsError;
    for (const row of ents ?? []) {
      const r = row as Record<string, unknown>;
      entsByVersion.set(
        String(r.plan_version_id),
        mapEntitlementRow(planId, r)
      );
    }
  }

  return (versions ?? []).map((v) => {
    const row = v as Record<string, unknown>;
    const status = String(row.status) as PlanVersionStatus;
    return {
      id: String(row.id),
      planId,
      version: Number(row.version),
      status:
        status === "draft" || status === "active" || status === "retired"
          ? status
          : "retired",
      effectiveFrom: String(row.effective_from),
      changeReason: (row.change_reason as string | null) ?? null,
      createdBy: (row.created_by as string | null) ?? null,
      createdAt: String(row.created_at),
      supersededVersionId: (row.superseded_version_id as string | null) ?? null,
      product: parseProductSnapshot(row.product_snapshot, planId),
      entitlements:
        entsByVersion.get(String(row.id)) ?? {
          ...PLAN_ENTITLEMENTS[planId],
          modelFamilies: [...PLAN_ENTITLEMENTS[planId].modelFamilies],
        },
    };
  });
}

export async function listAdminPlans(): Promise<
  Array<{
    planId: LaunchPlanId;
    label: string;
    public: boolean;
    amountEurCentsMonthly: number;
    activeVersion: number | null;
    activeCampaignCount: number;
  }>
> {
  const admin = createSupabaseAdminClient();
  const { data: plans, error } = await admin
    .from("plans")
    .select(
      "id, label, public, amount_eur_cents_monthly, active, sort_order"
    )
    .in("id", ["free", "lite", "pro"])
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const { data: versions } = await admin
    .from("plan_versions")
    .select("plan_id, version")
    .eq("status", "active")
    .in("plan_id", ["free", "lite", "pro"]);

  const { data: campaigns } = await admin
    .from("plan_campaign_overrides")
    .select("plan_id, starts_at, ends_at, revoked_at")
    .in("plan_id", ["free", "lite", "pro"])
    .is("revoked_at", null);

  const versionByPlan = new Map<string, number>();
  for (const v of versions ?? []) {
    versionByPlan.set(String(v.plan_id), Number(v.version));
  }

  const now = new Date();
  const campaignCount = new Map<string, number>();
  for (const c of campaigns ?? []) {
    const row = c as Record<string, unknown>;
    if (
      isCampaignActive({
        startsAt: String(row.starts_at),
        endsAt: String(row.ends_at),
        revokedAt: (row.revoked_at as string | null) ?? null,
      }, now)
    ) {
      const pid = String(row.plan_id);
      campaignCount.set(pid, (campaignCount.get(pid) ?? 0) + 1);
    }
  }

  return (plans ?? [])
    .filter((p) => isLaunchPlanId(String(p.id)))
    .map((p) => {
      const planId = String(p.id) as LaunchPlanId;
      return {
        planId,
        label: String(p.label),
        public: Boolean(p.public),
        amountEurCentsMonthly: Number(p.amount_eur_cents_monthly),
        activeVersion: versionByPlan.get(planId) ?? null,
        activeCampaignCount: campaignCount.get(planId) ?? 0,
      };
    });
}

export async function getAdminPlanDetail(
  planId: string
): Promise<AdminPlanDetail> {
  if (!isLaunchPlanId(planId)) {
    throw new Error("planId must be free, lite, or pro");
  }
  const admin = createSupabaseAdminClient();
  const { data: plan, error } = await admin
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const versions = await loadVersionSummaries(planId);
  const activeVersion = versions.find((v) => v.status === "active") ?? null;

  const { data: campaigns, error: campError } = await admin
    .from("plan_campaign_overrides")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false });
  if (campError) throw campError;

  return {
    planId,
    product: {
      label: String(plan.label),
      purpose: String(plan.purpose),
      amountEurCentsMonthly: Number(plan.amount_eur_cents_monthly),
      amountEurCentsAnnual:
        plan.amount_eur_cents_annual == null
          ? null
          : Number(plan.amount_eur_cents_annual),
      foundingEurCentsMonthly:
        plan.founding_eur_cents_monthly == null
          ? null
          : Number(plan.founding_eur_cents_monthly),
      stripePriceEnvMonthly:
        (plan.stripe_price_env_monthly as string | null) ?? null,
      stripePriceEnvAnnual:
        (plan.stripe_price_env_annual as string | null) ?? null,
      features: Array.isArray(plan.features)
        ? (plan.features as string[])
        : [],
      public: Boolean(plan.public),
      active: Boolean(plan.active),
      sortOrder: Number(plan.sort_order ?? 0),
    },
    activeVersion,
    versions,
    campaigns: (campaigns ?? []).map((c) =>
      mapCampaignRow(c as Record<string, unknown>)
    ),
    modelFamilyOptions: [...ALL_MODEL_FAMILIES],
  };
}

/**
 * Publish a new active plan version. Retires the previous active version,
 * updates the plans product row from the validated snapshot, audits, and
 * clears the in-process catalog cache.
 */
export async function publishPlanVersion(params: {
  planId: LaunchPlanId;
  product: PlanProductInput;
  entitlements: PlanEntitlementInput;
  reason: string;
  actorUserId: string;
  effectiveFrom?: string | Date;
}): Promise<PlanVersionSummary> {
  if (!isLaunchPlanId(params.planId)) {
    throw new Error("planId must be free, lite, or pro");
  }
  const reason = requireReason(params.reason);
  const product = validateProduct(params.planId, params.product);
  const entitlements = validateEntitlements(params.planId, params.entitlements);
  const effectiveFrom = toIso(params.effectiveFrom ?? new Date());

  const admin = createSupabaseAdminClient();

  const { data: maxRow, error: maxError } = await admin
    .from("plan_versions")
    .select("version")
    .eq("plan_id", params.planId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) throw maxError;
  const previousVersion = maxRow ? Number(maxRow.version) : null;

  const { data: currentActive } = await admin
    .from("plan_versions")
    .select("id, version")
    .eq("plan_id", params.planId)
    .eq("status", "active")
    .maybeSingle();

  const entitlementPayload = {
    auto_monthly_turns: entitlements.autoMonthlyTurns,
    unlimited_auto: entitlements.unlimitedAuto,
    auto_fair_use_daily_credits: entitlements.autoFairUseDailyCredits,
    auto_fair_use_period_credits: entitlements.autoFairUsePeriodCredits,
    frontier_monthly_turns: entitlements.frontierMonthlyTurns,
    max_frontier_credits_per_turn: entitlements.maxFrontierCreditsPerTurn,
    frontier_soft_credit_cap: entitlements.frontierSoftCreditCap,
    frontier_heavy_ratio: entitlements.frontierHeavyRatio,
    attachments: entitlements.attachments,
    storage_bytes: entitlements.storageBytes,
    byok: entitlements.byok,
    voice: entitlements.voice,
    elevated_limits: entitlements.elevatedLimits,
    model_families: entitlements.modelFamilies,
  };

  const { data: versionIdRaw, error: rpcError } = await admin.rpc(
    "admin_publish_plan_version",
    {
      p_plan_id: params.planId,
      p_change_reason: reason,
      p_created_by: params.actorUserId,
      p_effective_from: effectiveFrom,
      p_product_snapshot: productSnapshotJson(product),
      p_entitlements: entitlementPayload,
    }
  );
  if (rpcError) throw rpcError;
  const versionId = String(versionIdRaw);

  const { data: versionRow, error: versionError } = await admin
    .from("plan_versions")
    .select("version")
    .eq("id", versionId)
    .single();
  if (versionError) throw versionError;
  const nextVersion = Number(versionRow.version);

  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.plan_version.publish",
    targetType: "plan",
    targetId: params.planId,
    metadata: {
      reason,
      planId: params.planId,
      version: nextVersion,
      versionId,
      supersededVersionId: currentActive?.id ?? null,
      previousVersion: currentActive?.version ?? previousVersion,
      product,
      entitlements,
    },
  });

  clearPlanConfigCache();

  const detail = await getAdminPlanDetail(params.planId);
  const published = detail.versions.find((v) => v.id === versionId);
  if (!published) throw new Error("Published version not found after write");
  return published;
}

/**
 * Rollback by publishing a new version that copies entitlements + product
 * snapshot from a prior version. Never reactivates a retired row in place.
 */
export async function rollbackPlanVersion(params: {
  planId: LaunchPlanId;
  toVersionId: string;
  reason: string;
  actorUserId: string;
}): Promise<PlanVersionSummary> {
  if (!isLaunchPlanId(params.planId)) {
    throw new Error("planId must be free, lite, or pro");
  }
  const reason = requireReason(params.reason);
  const versions = await loadVersionSummaries(params.planId);
  const target = versions.find((v) => v.id === params.toVersionId);
  if (!target) {
    throw new Error("Target version not found for this plan");
  }
  if (target.status === "active") {
    throw new Error("Cannot rollback to the currently active version");
  }

  const published = await publishPlanVersion({
    planId: params.planId,
    product: target.product,
    entitlements: {
      autoMonthlyTurns: target.entitlements.autoMonthlyTurns,
      unlimitedAuto: target.entitlements.unlimitedAuto,
      autoFairUseDailyCredits: target.entitlements.autoFairUseDailyCredits,
      autoFairUsePeriodCredits: target.entitlements.autoFairUsePeriodCredits,
      frontierMonthlyTurns: target.entitlements.frontierMonthlyTurns,
      maxFrontierCreditsPerTurn: target.entitlements.maxFrontierCreditsPerTurn,
      frontierSoftCreditCap: target.entitlements.frontierSoftCreditCap,
      frontierHeavyRatio: target.entitlements.frontierHeavyRatio,
      attachments: target.entitlements.attachments,
      storageBytes: target.entitlements.storageBytes,
      byok: target.entitlements.byok,
      voice: target.entitlements.voice,
      elevatedLimits: target.entitlements.elevatedLimits,
      modelFamilies: [...target.entitlements.modelFamilies],
    },
    reason: `Rollback to v${target.version}: ${reason}`,
    actorUserId: params.actorUserId,
  });

  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.plan_version.rollback",
    targetType: "plan",
    targetId: params.planId,
    metadata: {
      reason,
      planId: params.planId,
      rolledBackToVersionId: target.id,
      rolledBackToVersion: target.version,
      newVersionId: published.id,
      newVersion: published.version,
    },
  });

  return published;
}

export async function createPlanCampaignOverride(params: {
  planId: LaunchPlanId;
  name: string;
  reason: string;
  startsAt: string | Date;
  endsAt: string | Date;
  entitlementOverrides: CampaignEntitlementOverrides;
  actorUserId: string;
}): Promise<PlanCampaignSummary> {
  if (!isLaunchPlanId(params.planId)) {
    throw new Error("planId must be free, lite, or pro");
  }
  const reason = requireReason(params.reason);
  const name = params.name.trim();
  if (!name) throw new Error("Campaign name is required");

  const startsAt = toIso(params.startsAt);
  const endsAt = toIso(params.endsAt);
  if (new Date(endsAt) <= new Date(startsAt)) {
    throw new Error("endsAt must be after startsAt");
  }

  const overrides = campaignEntitlementOverridesSchema.safeParse(
    params.entitlementOverrides ?? {}
  );
  if (!overrides.success) {
    throw new Error(
      `Invalid campaign overrides: ${overrides.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  if (Object.keys(overrides.data).length === 0) {
    throw new Error("At least one entitlement override is required");
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("plan_campaign_overrides")
    .insert({
      plan_id: params.planId,
      name,
      reason,
      starts_at: startsAt,
      ends_at: endsAt,
      entitlement_overrides: overrides.data,
      created_by: params.actorUserId,
    })
    .select("*")
    .single();
  if (error) throw error;

  const mapped = mapCampaignRow(data as Record<string, unknown>);

  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.plan_campaign.create",
    targetType: "plan_campaign",
    targetId: mapped.id,
    metadata: {
      reason,
      planId: params.planId,
      name,
      startsAt,
      endsAt,
      entitlementOverrides: overrides.data,
    },
  });

  clearPlanConfigCache();
  return mapped;
}

export async function revokePlanCampaignOverride(params: {
  id: string;
  reason: string;
  actorUserId: string;
}): Promise<PlanCampaignSummary> {
  const reason = requireReason(params.reason);
  const admin = createSupabaseAdminClient();
  const { data: existing, error: findError } = await admin
    .from("plan_campaign_overrides")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error("Campaign not found");
  if (existing.revoked_at) throw new Error("Campaign already revoked");

  const { data, error } = await admin
    .from("plan_campaign_overrides")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) throw error;

  const mapped = mapCampaignRow(data as Record<string, unknown>);

  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.plan_campaign.revoke",
    targetType: "plan_campaign",
    targetId: mapped.id,
    metadata: {
      reason,
      planId: mapped.planId,
      name: mapped.name,
    },
  });

  clearPlanConfigCache();
  return mapped;
}
