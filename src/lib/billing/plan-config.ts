/**
 * Plan catalog + entitlement resolver.
 *
 * Database is the preferred source; TypeScript defaults are the safe fallback.
 * Missing or malformed configuration never fails open (e.g. never treats a
 * broken Free turn cap as unlimited, never enables BYOK from bad JSON).
 */

import { z } from "zod";
import {
  MODEL_FAMILIES,
  PLAN_ENTITLEMENTS,
  SUBSCRIPTION_PLANS,
  type LaunchPlanId,
  type ModelFamilyId,
  type PlanEntitlements,
  type SubscriptionPlan,
} from "./plan-defaults";

export const PLAN_CONFIG_CACHE_TTL_MS = 60_000;

export type PlanConfigSource = "defaults" | "database";

export interface PlanVersionMeta {
  version: number;
  planVersionId: string;
  effectiveFrom: string;
}

/** Active campaign overlay applied on top of base entitlements. */
export interface ActiveCampaignOverlay {
  id: string;
  planId: LaunchPlanId;
  name: string;
  startsAt: string;
  endsAt: string;
  entitlementOverrides: Partial<
    Omit<PlanEntitlements, "planId" | "unlimitedAuto">
  >;
}

export interface PlanCatalog {
  source: PlanConfigSource;
  loadedAt: number;
  plans: Record<LaunchPlanId, SubscriptionPlan>;
  entitlements: Record<LaunchPlanId, PlanEntitlements>;
  versions: Partial<Record<LaunchPlanId, PlanVersionMeta>>;
  /** Active campaign overlays keyed by plan (may be empty). */
  campaigns: Partial<Record<LaunchPlanId, ActiveCampaignOverlay[]>>;
  /** Plans that fell back to TypeScript defaults due to missing/invalid rows. */
  fallbackPlanIds: LaunchPlanId[];
}

const LAUNCH_PLAN_IDS: LaunchPlanId[] = ["free", "lite", "pro"];

const featuresSchema = z.array(z.string().min(1)).min(1);

const modelFamilySchema = z.enum(
  MODEL_FAMILIES as unknown as [ModelFamilyId, ...ModelFamilyId[]]
);

export const subscriptionPlanSchema = z.object({
  id: z.enum(["free", "lite", "pro"]),
  label: z.string().min(1),
  purpose: z.string().min(1),
  amountEurCentsMonthly: z.number().int().nonnegative(),
  amountEurCentsAnnual: z.number().int().nonnegative().optional(),
  stripePriceEnvMonthly: z.string().min(1).optional(),
  stripePriceEnvAnnual: z.string().min(1).optional(),
  foundingEurCentsMonthly: z.number().int().nonnegative().optional(),
  features: featuresSchema,
  public: z.boolean(),
});

/**
 * Entitlement row schema. Null turn caps mean unlimited only when explicitly
 * null (and consistent with unlimitedAuto). Malformed values fail the parse —
 * callers then use TypeScript defaults instead of inventing permissive gates.
 */
export const planEntitlementsSchema = z
  .object({
    planId: z.enum(["free", "lite", "pro"]),
    autoMonthlyTurns: z.number().int().nonnegative().nullable(),
    unlimitedAuto: z.boolean(),
    autoFairUseDailyCredits: z.number().int().nonnegative(),
    autoFairUsePeriodCredits: z.number().int().nonnegative(),
    frontierMonthlyTurns: z.number().int().nonnegative().nullable(),
    maxFrontierCreditsPerTurn: z.number().int().nonnegative(),
    frontierSoftCreditCap: z.number().int().nonnegative().nullable(),
    frontierHeavyRatio: z.number().min(0).max(1),
    attachments: z.boolean(),
    storageBytes: z.number().int().nonnegative(),
    byok: z.boolean(),
    voice: z.boolean(),
    elevatedLimits: z.boolean(),
    modelFamilies: z.array(modelFamilySchema),
  })
  .superRefine((val, ctx) => {
    const unlimited = val.autoMonthlyTurns == null;
    if (val.unlimitedAuto !== unlimited) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "unlimitedAuto must be true iff autoMonthlyTurns is null",
        path: ["unlimitedAuto"],
      });
    }
  });

/** Partial entitlement overrides used by campaigns (no planId / unlimitedAuto). */
export const campaignEntitlementOverridesSchema = z
  .object({
    autoMonthlyTurns: z.number().int().nonnegative().nullable().optional(),
    autoFairUseDailyCredits: z.number().int().nonnegative().optional(),
    autoFairUsePeriodCredits: z.number().int().nonnegative().optional(),
    frontierMonthlyTurns: z.number().int().nonnegative().nullable().optional(),
    maxFrontierCreditsPerTurn: z.number().int().nonnegative().optional(),
    frontierSoftCreditCap: z.number().int().nonnegative().nullable().optional(),
    frontierHeavyRatio: z.number().min(0).max(1).optional(),
    attachments: z.boolean().optional(),
    storageBytes: z.number().int().nonnegative().optional(),
    byok: z.boolean().optional(),
    voice: z.boolean().optional(),
    elevatedLimits: z.boolean().optional(),
    modelFamilies: z.array(modelFamilySchema).optional(),
  })
  .strict();

export type CampaignEntitlementOverrides = z.infer<
  typeof campaignEntitlementOverridesSchema
>;

export type RawPlanRow = {
  id: string;
  label: string;
  purpose: string;
  amount_eur_cents_monthly: number;
  amount_eur_cents_annual: number | null;
  founding_eur_cents_monthly: number | null;
  stripe_price_env_monthly: string | null;
  stripe_price_env_annual: string | null;
  features: unknown;
  public: boolean;
  active: boolean;
  sort_order: number;
};

export type RawPlanVersionRow = {
  id: string;
  plan_id: string;
  version: number;
  status: string;
  effective_from: string;
};

export type RawPlanEntitlementRow = {
  plan_version_id: string;
  auto_monthly_turns: number | null;
  unlimited_auto: boolean;
  auto_fair_use_daily_credits: number;
  auto_fair_use_period_credits: number;
  frontier_monthly_turns: number | null;
  max_frontier_credits_per_turn: number;
  frontier_soft_credit_cap: number | null;
  frontier_heavy_ratio: number;
  attachments: boolean;
  storage_bytes: number;
  byok: boolean;
  voice: boolean;
  elevated_limits: boolean;
  model_families?: unknown;
};

export type RawCampaignOverrideRow = {
  id: string;
  plan_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  entitlement_overrides: unknown;
  revoked_at: string | null;
};

let cache: PlanCatalog | null = null;

export function isLaunchPlanId(value: string): value is LaunchPlanId {
  return value === "free" || value === "lite" || value === "pro";
}

function parseModelFamilies(raw: unknown): ModelFamilyId[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const out: ModelFamilyId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") return null;
    if (!(MODEL_FAMILIES as readonly string[]).includes(item)) return null;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item as ModelFamilyId);
  }
  return out;
}

export function getDefaultPlanCatalog(): PlanCatalog {
  const plans = {} as Record<LaunchPlanId, SubscriptionPlan>;
  for (const plan of SUBSCRIPTION_PLANS) {
    plans[plan.id] = { ...plan, features: [...plan.features] };
  }
  const entitlements = {} as Record<LaunchPlanId, PlanEntitlements>;
  for (const id of LAUNCH_PLAN_IDS) {
    entitlements[id] = {
      ...PLAN_ENTITLEMENTS[id],
      modelFamilies: [...PLAN_ENTITLEMENTS[id].modelFamilies],
    };
  }
  return {
    source: "defaults",
    loadedAt: Date.now(),
    plans,
    entitlements,
    versions: {},
    campaigns: {},
    fallbackPlanIds: [...LAUNCH_PLAN_IDS],
  };
}

export function parseSubscriptionPlan(
  raw: RawPlanRow
): SubscriptionPlan | null {
  if (!raw.active) return null;
  if (!isLaunchPlanId(raw.id)) return null;

  const candidate = {
    id: raw.id,
    label: raw.label,
    purpose: raw.purpose,
    amountEurCentsMonthly: raw.amount_eur_cents_monthly,
    ...(raw.amount_eur_cents_annual != null
      ? { amountEurCentsAnnual: raw.amount_eur_cents_annual }
      : {}),
    ...(raw.founding_eur_cents_monthly != null
      ? { foundingEurCentsMonthly: raw.founding_eur_cents_monthly }
      : {}),
    ...(raw.stripe_price_env_monthly
      ? { stripePriceEnvMonthly: raw.stripe_price_env_monthly }
      : {}),
    ...(raw.stripe_price_env_annual
      ? { stripePriceEnvAnnual: raw.stripe_price_env_annual }
      : {}),
    features: raw.features,
    public: raw.public,
  };

  const parsed = subscriptionPlanSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parsePlanEntitlements(
  planId: LaunchPlanId,
  raw: RawPlanEntitlementRow
): PlanEntitlements | null {
  const modelFamilies = parseModelFamilies(raw.model_families ?? []);
  if (modelFamilies == null) return null;

  const candidate = {
    planId,
    autoMonthlyTurns: raw.auto_monthly_turns,
    unlimitedAuto: raw.unlimited_auto,
    autoFairUseDailyCredits: raw.auto_fair_use_daily_credits,
    autoFairUsePeriodCredits: raw.auto_fair_use_period_credits,
    frontierMonthlyTurns: raw.frontier_monthly_turns,
    maxFrontierCreditsPerTurn: raw.max_frontier_credits_per_turn,
    frontierSoftCreditCap: raw.frontier_soft_credit_cap,
    frontierHeavyRatio: raw.frontier_heavy_ratio,
    attachments: raw.attachments,
    storageBytes: Number(raw.storage_bytes),
    byok: raw.byok,
    voice: raw.voice,
    elevatedLimits: raw.elevated_limits,
    modelFamilies,
  };

  const parsed = planEntitlementsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Apply campaign entitlement overrides onto a base plan entitlement.
 * Only validated keys are applied; unlimitedAuto is derived from turns.
 */
export function applyCampaignOverrides(
  base: PlanEntitlements,
  overlays: Array<Pick<ActiveCampaignOverlay, "entitlementOverrides">>,
): PlanEntitlements {
  if (overlays.length === 0) return base;
  let next: PlanEntitlements = { ...base, modelFamilies: [...base.modelFamilies] };
  for (const overlay of overlays) {
    const o = overlay.entitlementOverrides;
    if (!o || Object.keys(o).length === 0) continue;
    const merged = { ...next, ...o };
    if ("modelFamilies" in o && o.modelFamilies) {
      merged.modelFamilies = [...o.modelFamilies];
    }
    if ("autoMonthlyTurns" in o) {
      merged.unlimitedAuto = o.autoMonthlyTurns == null;
    }
    next = merged;
  }
  return next;
}

export function parseCampaignOverlay(
  raw: RawCampaignOverrideRow,
  now: Date = new Date()
): ActiveCampaignOverlay | null {
  if (raw.revoked_at) return null;
  if (!isLaunchPlanId(raw.plan_id)) return null;
  const start = new Date(raw.starts_at);
  const end = new Date(raw.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() <= start.getTime()) return null;
  if (start.getTime() > now.getTime()) return null;
  if (end.getTime() <= now.getTime()) return null;

  const parsed = campaignEntitlementOverridesSchema.safeParse(
    raw.entitlement_overrides ?? {}
  );
  if (!parsed.success) return null;

  return {
    id: raw.id,
    planId: raw.plan_id,
    name: raw.name,
    startsAt: raw.starts_at,
    endsAt: raw.ends_at,
    entitlementOverrides: parsed.data,
  };
}

/**
 * Build a catalog from DB rows. Any launch plan with missing/invalid product
 * or entitlement data falls back to TypeScript defaults for that plan only.
 */
export function buildPlanCatalogFromRows(input: {
  plans: RawPlanRow[];
  versions: RawPlanVersionRow[];
  entitlements: RawPlanEntitlementRow[];
  campaigns?: RawCampaignOverrideRow[];
  now?: number;
}): PlanCatalog {
  const defaults = getDefaultPlanCatalog();
  const plans = { ...defaults.plans };
  const entitlements = { ...defaults.entitlements };
  const versions: Partial<Record<LaunchPlanId, PlanVersionMeta>> = {};
  const campaigns: Partial<Record<LaunchPlanId, ActiveCampaignOverlay[]>> = {};
  const fallbackPlanIds = new Set<LaunchPlanId>(LAUNCH_PLAN_IDS);
  const nowMs = input.now ?? Date.now();
  const nowDate = new Date(nowMs);

  const versionById = new Map<string, RawPlanVersionRow>();
  for (const version of input.versions) {
    if (version.status !== "active") continue;
    if (!isLaunchPlanId(version.plan_id)) continue;
    if (!Number.isInteger(version.version) || version.version < 1) continue;
    versionById.set(version.id, version);
  }

  const entitlementByVersionId = new Map<string, RawPlanEntitlementRow>();
  for (const row of input.entitlements) {
    entitlementByVersionId.set(row.plan_version_id, row);
  }

  const planById = new Map<string, RawPlanRow>();
  for (const plan of input.plans) {
    planById.set(plan.id, plan);
  }

  for (const planId of LAUNCH_PLAN_IDS) {
    const rawPlan = planById.get(planId);
    const parsedPlan = rawPlan ? parseSubscriptionPlan(rawPlan) : null;

    const activeVersion = [...versionById.values()].find(
      (v) => v.plan_id === planId
    );
    const rawEnt = activeVersion
      ? entitlementByVersionId.get(activeVersion.id)
      : undefined;
    const parsedEnt =
      activeVersion && rawEnt
        ? parsePlanEntitlements(planId, rawEnt)
        : null;

    // Both product + entitlement rows must be valid; otherwise keep defaults.
    // Never partially apply a broken row (avoids fail-open on single fields).
    if (!parsedPlan || !parsedEnt || !activeVersion) {
      continue;
    }

    plans[planId] = parsedPlan;
    entitlements[planId] = parsedEnt;
    versions[planId] = {
      version: activeVersion.version,
      planVersionId: activeVersion.id,
      effectiveFrom: activeVersion.effective_from,
    };
    fallbackPlanIds.delete(planId);
  }

  for (const raw of input.campaigns ?? []) {
    const overlay = parseCampaignOverlay(raw, nowDate);
    if (!overlay) continue;
    const list = campaigns[overlay.planId] ?? [];
    list.push(overlay);
    campaigns[overlay.planId] = list;
  }

  // Apply active campaigns onto resolved base entitlements (after validation).
  for (const planId of LAUNCH_PLAN_IDS) {
    const overlays = campaigns[planId];
    if (!overlays?.length) continue;
    entitlements[planId] = applyCampaignOverrides(
      entitlements[planId],
      overlays
    );
  }

  return {
    source:
      fallbackPlanIds.size === LAUNCH_PLAN_IDS.length
        ? "defaults"
        : "database",
    loadedAt: nowMs,
    plans,
    entitlements,
    versions,
    campaigns,
    fallbackPlanIds: [...fallbackPlanIds],
  };
}

export function getCachedPlanCatalog(): PlanCatalog | null {
  return cache;
}

export function setCachedPlanCatalog(catalog: PlanCatalog): void {
  cache = catalog;
}

export function clearPlanConfigCache(): void {
  cache = null;
}

export function isPlanConfigCacheFresh(
  catalog: PlanCatalog | null = cache,
  now: number = Date.now(),
  ttlMs: number = PLAN_CONFIG_CACHE_TTL_MS
): boolean {
  if (!catalog) return false;
  return now - catalog.loadedAt < ttlMs;
}

/** Sync read: cached catalog when present, otherwise TypeScript defaults. */
export function resolvePlanCatalogSync(): PlanCatalog {
  return cache ?? getDefaultPlanCatalog();
}

export function entitlementsFromCatalog(
  catalog: PlanCatalog,
  planId: string
): PlanEntitlements {
  if (isLaunchPlanId(planId)) {
    return catalog.entitlements[planId];
  }
  // Unknown / canceled / legacy → Free gates (most restrictive launch default)
  return catalog.entitlements.free;
}

export function subscriptionPlanFromCatalog(
  catalog: PlanCatalog,
  planId: string
): SubscriptionPlan | null {
  if (!isLaunchPlanId(planId)) return null;
  return catalog.plans[planId] ?? null;
}

export function publicPlansFromCatalog(catalog: PlanCatalog): SubscriptionPlan[] {
  return LAUNCH_PLAN_IDS.map((id) => catalog.plans[id]).filter((p) => p.public);
}
