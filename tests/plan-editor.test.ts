import { afterEach, describe, expect, it } from "vitest";
import {
  ALL_MODEL_FAMILIES,
  PLAN_ENTITLEMENTS,
} from "../src/lib/billing/plan-defaults";
import {
  applyCampaignOverrides,
  buildPlanCatalogFromRows,
  clearPlanConfigCache,
  parseCampaignOverlay,
  parsePlanEntitlements,
  type RawCampaignOverrideRow,
  type RawPlanEntitlementRow,
  type RawPlanRow,
  type RawPlanVersionRow,
} from "../src/lib/billing/plan-config";
import { SUBSCRIPTION_PLANS } from "../src/lib/billing/products";

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
    model_families: [...e.modelFamilies],
    ...overrides,
  };
}

function seedVersion(
  planId: "free" | "lite" | "pro",
  id: string
): RawPlanVersionRow {
  return {
    id,
    plan_id: planId,
    version: 1,
    status: "active",
    effective_from: "2026-07-22T00:00:00.000Z",
  };
}

const LITE_VID = "a0000000-0000-4000-8000-000000000002";
const PRO_VID = "a0000000-0000-4000-8000-000000000003";
const FREE_VID = "a0000000-0000-4000-8000-000000000001";

describe("model family entitlements", () => {
  it("parses model families and rejects unknown families", () => {
    expect(
      parsePlanEntitlements(
        "lite",
        seedEntitlementRow("lite", LITE_VID)
      )?.modelFamilies
    ).toEqual([...ALL_MODEL_FAMILIES]);

    expect(
      parsePlanEntitlements(
        "free",
        seedEntitlementRow("free", FREE_VID, {
          model_families: ["openai", "not-a-family"],
        })
      )
    ).toBeNull();
  });

  it("defaults missing model_families to empty (never invents Pro access)", () => {
    const raw = seedEntitlementRow("free", FREE_VID);
    delete raw.model_families;
    expect(parsePlanEntitlements("free", raw)?.modelFamilies).toEqual([]);
  });
});

describe("campaign overlays", () => {
  it("raises Lite Frontier turns temporarily without mutating the base row", () => {
    const base = PLAN_ENTITLEMENTS.lite;
    const next = applyCampaignOverrides(base, [
      { entitlementOverrides: { frontierMonthlyTurns: 25 } },
    ]);
    expect(next.frontierMonthlyTurns).toBe(25);
    expect(base.frontierMonthlyTurns).toBe(10);
    expect(next.unlimitedAuto).toBe(true);
    expect(next.modelFamilies).toEqual(base.modelFamilies);
  });

  it("derives unlimitedAuto when a campaign nulls autoMonthlyTurns", () => {
    const next = applyCampaignOverrides(PLAN_ENTITLEMENTS.free, [
      { entitlementOverrides: { autoMonthlyTurns: null } },
    ]);
    expect(next.autoMonthlyTurns).toBeNull();
    expect(next.unlimitedAuto).toBe(true);
  });

  it("ignores revoked / out-of-window campaigns when building the catalog", () => {
    const now = Date.parse("2026-08-15T12:00:00.000Z");
    const campaigns: RawCampaignOverrideRow[] = [
      {
        id: "c0000000-0000-4000-8000-000000000001",
        plan_id: "lite",
        name: "active boost",
        starts_at: "2026-08-01T00:00:00.000Z",
        ends_at: "2026-09-01T00:00:00.000Z",
        entitlement_overrides: { frontierMonthlyTurns: 25 },
        revoked_at: null,
      },
      {
        id: "c0000000-0000-4000-8000-000000000002",
        plan_id: "lite",
        name: "revoked",
        starts_at: "2026-08-01T00:00:00.000Z",
        ends_at: "2026-09-01T00:00:00.000Z",
        entitlement_overrides: { frontierMonthlyTurns: 99 },
        revoked_at: "2026-08-02T00:00:00.000Z",
      },
      {
        id: "c0000000-0000-4000-8000-000000000003",
        plan_id: "lite",
        name: "expired",
        starts_at: "2026-07-01T00:00:00.000Z",
        ends_at: "2026-08-01T00:00:00.000Z",
        entitlement_overrides: { frontierMonthlyTurns: 50 },
        revoked_at: null,
      },
    ];

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
      campaigns,
      now,
    });

    expect(catalog.entitlements.lite.frontierMonthlyTurns).toBe(25);
    expect(catalog.campaigns.lite).toHaveLength(1);
    expect(catalog.campaigns.lite?.[0]?.name).toBe("active boost");
    // Base Pro untouched
    expect(catalog.entitlements.pro.frontierMonthlyTurns).toBeNull();
  });

  it("rejects malformed campaign override payloads", () => {
    expect(
      parseCampaignOverlay({
        id: "c0000000-0000-4000-8000-000000000099",
        plan_id: "lite",
        name: "bad",
        starts_at: "2026-08-01T00:00:00.000Z",
        ends_at: "2026-09-01T00:00:00.000Z",
        entitlement_overrides: { byok: "yes" },
        revoked_at: null,
      }, new Date("2026-08-15T00:00:00.000Z"))
    ).toBeNull();
  });
});
