import { afterEach, describe, expect, it } from "vitest";
import {
  PLAN_ENTITLEMENTS,
  entitlementsForPlan,
} from "../src/lib/billing/entitlements";
import {
  SUBSCRIPTION_PLANS,
  getPublicPlans,
  getSubscriptionPlan,
} from "../src/lib/billing/products";
import {
  buildPlanCatalogFromRows,
  clearPlanConfigCache,
  getDefaultPlanCatalog,
  isPlanConfigCacheFresh,
  parsePlanEntitlements,
  parseSubscriptionPlan,
  setCachedPlanCatalog,
  type RawPlanEntitlementRow,
  type RawPlanRow,
  type RawPlanVersionRow,
} from "../src/lib/billing/plan-config";

afterEach(() => {
  clearPlanConfigCache();
});

function seedPlanRow(
  id: "free" | "lite" | "pro",
  overrides: Partial<RawPlanRow> = {}
): RawPlanRow {
  const base = SUBSCRIPTION_PLANS.find((p) => p.id === id)!;
  return {
    id,
    label: base.label,
    purpose: base.purpose,
    amount_eur_cents_monthly: base.amountEurCentsMonthly,
    amount_eur_cents_annual: base.amountEurCentsAnnual ?? null,
    founding_eur_cents_monthly: base.foundingEurCentsMonthly ?? null,
    stripe_price_env_monthly: base.stripePriceEnvMonthly ?? null,
    stripe_price_env_annual: base.stripePriceEnvAnnual ?? null,
    features: [...base.features],
    public: true,
    active: true,
    sort_order: id === "free" ? 0 : id === "lite" ? 1 : 2,
    ...overrides,
  };
}

function seedEntitlementRow(
  planId: "free" | "lite" | "pro",
  planVersionId: string,
  overrides: Partial<RawPlanEntitlementRow> = {}
): RawPlanEntitlementRow {
  const e = PLAN_ENTITLEMENTS[planId];
  return {
    plan_version_id: planVersionId,
    auto_monthly_turns: e.autoMonthlyTurns,
    unlimited_auto: e.unlimitedAuto,
    auto_fair_use_daily_credits: e.autoFairUseDailyCredits,
    auto_fair_use_period_credits: e.autoFairUsePeriodCredits,
    frontier_monthly_turns: e.frontierMonthlyTurns,
    max_frontier_credits_per_turn: e.maxFrontierCreditsPerTurn,
    frontier_soft_credit_cap: e.frontierSoftCreditCap,
    frontier_heavy_ratio: e.frontierHeavyRatio,
    attachments: e.attachments,
    storage_bytes: e.storageBytes,
    byok: e.byok,
    voice: e.voice,
    elevated_limits: e.elevatedLimits,
    ...overrides,
  };
}

function seedVersion(
  planId: "free" | "lite" | "pro",
  id: string,
  overrides: Partial<RawPlanVersionRow> = {}
): RawPlanVersionRow {
  return {
    id,
    plan_id: planId,
    version: 1,
    status: "active",
    effective_from: "2026-07-22T00:00:00.000Z",
    ...overrides,
  };
}

const FREE_VID = "a0000000-0000-4000-8000-000000000001";
const LITE_VID = "a0000000-0000-4000-8000-000000000002";
const PRO_VID = "a0000000-0000-4000-8000-000000000003";

describe("plan config defaults fallback", () => {
  it("exposes TypeScript Free/Lite/Pro defaults when cache is empty", () => {
    const catalog = getDefaultPlanCatalog();
    expect(catalog.source).toBe("defaults");
    expect(catalog.entitlements.free.autoMonthlyTurns).toBe(30);
    expect(catalog.entitlements.lite.frontierMonthlyTurns).toBe(10);
    expect(catalog.entitlements.pro.byok).toBe(true);
    expect(entitlementsForPlan("free")).toEqual(PLAN_ENTITLEMENTS.free);
    expect(entitlementsForPlan("team").planId).toBe("free");
    expect(getPublicPlans().map((p) => p.id)).toEqual(["free", "lite", "pro"]);
  });
});

describe("plan config validation", () => {
  it("accepts seeded launch rows that match TypeScript defaults", () => {
    const catalog = buildPlanCatalogFromRows({
      plans: [
        seedPlanRow("free"),
        seedPlanRow("lite"),
        seedPlanRow("pro"),
      ],
      versions: [
        seedVersion("free", FREE_VID),
        seedVersion("lite", LITE_VID),
        seedVersion("pro", PRO_VID),
      ],
      entitlements: [
        seedEntitlementRow("free", FREE_VID),
        seedEntitlementRow("lite", LITE_VID),
        seedEntitlementRow("pro", PRO_VID),
      ],
    });

    expect(catalog.source).toBe("database");
    expect(catalog.fallbackPlanIds).toEqual([]);
    expect(catalog.entitlements.free).toEqual(PLAN_ENTITLEMENTS.free);
    expect(catalog.entitlements.lite).toEqual(PLAN_ENTITLEMENTS.lite);
    expect(catalog.entitlements.pro).toEqual(PLAN_ENTITLEMENTS.pro);
    expect(catalog.plans.pro.amountEurCentsMonthly).toBe(2_800);
    expect(catalog.versions.pro?.version).toBe(1);
  });

  it("rejects unlimited_auto mismatch instead of treating Free as unlimited", () => {
    const parsed = parsePlanEntitlements(
      "free",
      seedEntitlementRow("free", FREE_VID, {
        // Malformed: turns capped but flagged unlimited
        auto_monthly_turns: 30,
        unlimited_auto: true,
      })
    );
    expect(parsed).toBeNull();
  });

  it("rejects non-boolean feature flags instead of enabling them", () => {
    const parsed = parsePlanEntitlements("free", {
      ...seedEntitlementRow("free", FREE_VID),
      // @ts-expect-error intentional malformed input
      byok: "yes",
    });
    expect(parsed).toBeNull();
  });

  it("rejects empty feature lists on product rows", () => {
    expect(
      parseSubscriptionPlan(seedPlanRow("lite", { features: [] }))
    ).toBeNull();
    expect(
      parseSubscriptionPlan(seedPlanRow("lite", { features: "oops" }))
    ).toBeNull();
  });
});

describe("plan config safe fallback", () => {
  it("falls back per-plan when entitlement row is missing", () => {
    const catalog = buildPlanCatalogFromRows({
      plans: [
        seedPlanRow("free"),
        seedPlanRow("lite"),
        seedPlanRow("pro"),
      ],
      versions: [
        seedVersion("free", FREE_VID),
        seedVersion("lite", LITE_VID),
        seedVersion("pro", PRO_VID),
      ],
      // Pro entitlements intentionally omitted
      entitlements: [
        seedEntitlementRow("free", FREE_VID),
        seedEntitlementRow("lite", LITE_VID),
      ],
    });

    expect(catalog.source).toBe("database");
    expect(catalog.fallbackPlanIds).toEqual(["pro"]);
    expect(catalog.entitlements.pro).toEqual(PLAN_ENTITLEMENTS.pro);
    expect(catalog.entitlements.lite.frontierMonthlyTurns).toBe(10);
  });

  it("falls back when unlimited mismatch would otherwise fail open", () => {
    const catalog = buildPlanCatalogFromRows({
      plans: [seedPlanRow("free")],
      versions: [seedVersion("free", FREE_VID)],
      entitlements: [
        seedEntitlementRow("free", FREE_VID, {
          auto_monthly_turns: null,
          unlimited_auto: false,
        }),
      ],
    });

    expect(catalog.fallbackPlanIds).toContain("free");
    expect(catalog.entitlements.free.autoMonthlyTurns).toBe(30);
    expect(catalog.entitlements.free.unlimitedAuto).toBe(false);
    expect(catalog.entitlements.free.byok).toBe(false);
  });

  it("never grants Pro from an unknown plan id", () => {
    setCachedPlanCatalog(
      buildPlanCatalogFromRows({
        plans: [
          seedPlanRow("free"),
          seedPlanRow("lite"),
          seedPlanRow("pro"),
        ],
        versions: [
          seedVersion("free", FREE_VID),
          seedVersion("lite", LITE_VID),
          seedVersion("pro", PRO_VID),
        ],
        entitlements: [
          seedEntitlementRow("free", FREE_VID),
          seedEntitlementRow("lite", LITE_VID),
          seedEntitlementRow("pro", PRO_VID),
        ],
      })
    );

    expect(entitlementsForPlan("team")).toEqual(PLAN_ENTITLEMENTS.free);
    expect(entitlementsForPlan("executive").byok).toBe(false);
    expect(getSubscriptionPlan("max")).toBeNull();
  });

  it("uses cached catalog for sync entitlement helpers", () => {
    const catalog = buildPlanCatalogFromRows({
      plans: [
        seedPlanRow("free"),
        seedPlanRow("lite", { label: "Lite DB" }),
        seedPlanRow("pro"),
      ],
      versions: [
        seedVersion("free", FREE_VID),
        seedVersion("lite", LITE_VID),
        seedVersion("pro", PRO_VID),
      ],
      entitlements: [
        seedEntitlementRow("free", FREE_VID, { auto_monthly_turns: 25 }),
        seedEntitlementRow("lite", LITE_VID),
        seedEntitlementRow("pro", PRO_VID),
      ],
    });
    setCachedPlanCatalog(catalog);

    expect(entitlementsForPlan("free").autoMonthlyTurns).toBe(25);
    expect(getSubscriptionPlan("lite")?.label).toBe("Lite DB");
    expect(isPlanConfigCacheFresh(catalog, catalog.loadedAt + 1_000)).toBe(
      true
    );
    expect(
      isPlanConfigCacheFresh(catalog, catalog.loadedAt + 120_000)
    ).toBe(false);
  });
});
