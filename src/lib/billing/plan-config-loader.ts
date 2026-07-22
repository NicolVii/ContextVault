/**
 * Server-side loader for plan catalog + entitlements from Postgres.
 * Keep this module off the client bundle (uses the service-role client).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  PLAN_CONFIG_CACHE_TTL_MS,
  buildPlanCatalogFromRows,
  clearPlanConfigCache,
  getCachedPlanCatalog,
  getDefaultPlanCatalog,
  isPlanConfigCacheFresh,
  setCachedPlanCatalog,
  type PlanCatalog,
  type RawCampaignOverrideRow,
  type RawPlanEntitlementRow,
  type RawPlanRow,
  type RawPlanVersionRow,
} from "./plan-config";

export { clearPlanConfigCache };

/**
 * Load active plans / versions / entitlements from the database and validate.
 * On any I/O or structural failure, returns TypeScript defaults (never throws
 * into callers in a way that would skip entitlement checks).
 */
export async function loadPlanCatalogFromDatabase(): Promise<PlanCatalog> {
  try {
    const admin = createSupabaseAdminClient();

    const [plansRes, versionsRes, campaignsRes] = await Promise.all([
      admin
        .from("plans")
        .select(
          "id, label, purpose, amount_eur_cents_monthly, amount_eur_cents_annual, founding_eur_cents_monthly, stripe_price_env_monthly, stripe_price_env_annual, features, public, active, sort_order"
        )
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      admin
        .from("plan_versions")
        .select("id, plan_id, version, status, effective_from")
        .eq("status", "active"),
      admin
        .from("plan_campaign_overrides")
        .select(
          "id, plan_id, name, starts_at, ends_at, entitlement_overrides, revoked_at"
        )
        .is("revoked_at", null),
    ]);

    if (plansRes.error || versionsRes.error) {
      return getDefaultPlanCatalog();
    }

    const plans = (plansRes.data ?? []) as RawPlanRow[];
    const versions = (versionsRes.data ?? []) as RawPlanVersionRow[];
    const versionIds = versions.map((v) => v.id);
    const campaigns = campaignsRes.error
      ? []
      : ((campaignsRes.data ?? []) as RawCampaignOverrideRow[]);

    let entitlements: RawPlanEntitlementRow[] = [];
    if (versionIds.length > 0) {
      const entsRes = await admin
        .from("plan_entitlements")
        .select(
          "plan_version_id, auto_monthly_turns, unlimited_auto, auto_fair_use_daily_credits, auto_fair_use_period_credits, frontier_monthly_turns, max_frontier_credits_per_turn, frontier_soft_credit_cap, frontier_heavy_ratio, attachments, storage_bytes, byok, voice, elevated_limits, model_families"
        )
        .in("plan_version_id", versionIds);

      if (entsRes.error) {
        return getDefaultPlanCatalog();
      }
      entitlements = (entsRes.data ?? []) as RawPlanEntitlementRow[];
    }

    return buildPlanCatalogFromRows({
      plans,
      versions,
      entitlements,
      campaigns,
    });
  } catch {
    return getDefaultPlanCatalog();
  }
}

/**
 * Ensure the in-process catalog cache is populated and fresh.
 * Safe to call on every entitlement check — uses TTL caching.
 */
export async function ensurePlanConfigLoaded(options?: {
  force?: boolean;
  ttlMs?: number;
}): Promise<PlanCatalog> {
  const ttlMs = options?.ttlMs ?? PLAN_CONFIG_CACHE_TTL_MS;
  const existing = getCachedPlanCatalog();
  if (!options?.force && isPlanConfigCacheFresh(existing, Date.now(), ttlMs)) {
    return existing!;
  }

  const loaded = await loadPlanCatalogFromDatabase();
  setCachedPlanCatalog(loaded);
  return loaded;
}
