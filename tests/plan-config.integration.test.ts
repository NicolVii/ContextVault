import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";
import { assertIntegrationEnv } from "./setup-env";
import { PLAN_ENTITLEMENTS, entitlementsForPlan } from "../src/lib/billing/entitlements";
import { SUBSCRIPTION_PLANS } from "../src/lib/billing/products";
import { clearPlanConfigCache } from "../src/lib/billing/plan-config";
import {
  ensurePlanConfigLoaded,
  loadPlanCatalogFromDatabase,
} from "../src/lib/billing/plan-config-loader";

let user: TestUser;

beforeAll(async () => {
  assertIntegrationEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`health status ${res.status}`);
  } catch (err) {
    throw new Error(
      [
        `Supabase is not reachable at ${url}.`,
        "Start the local stack with `pnpm db:start` (Docker required), then re-run.",
        `Cause: ${err instanceof Error ? err.message : String(err)}`,
      ].join("\n")
    );
  }

  user = await createTestUser();
});

afterAll(async () => {
  if (user) await deleteTestUser(user.id).catch(() => {});
});

afterEach(() => {
  clearPlanConfigCache();
});

describe("plan entitlement config migration + seed (integration)", () => {
  it("seeds Free, Lite, and Pro plans with active versions", async () => {
    const admin = adminClient();
    const { data: plans, error } = await admin
      .from("plans")
      .select("id, label, amount_eur_cents_monthly, founding_eur_cents_monthly, public, active")
      .order("sort_order", { ascending: true });

    expect(error).toBeNull();
    expect(plans?.map((p: { id: string }) => p.id)).toEqual([
      "free",
      "lite",
      "pro",
    ]);
    expect(plans?.[0]?.amount_eur_cents_monthly).toBe(0);
    expect(plans?.[1]?.amount_eur_cents_monthly).toBe(500);
    expect(plans?.[2]?.amount_eur_cents_monthly).toBe(2_800);
    expect(plans?.[2]?.founding_eur_cents_monthly).toBe(2_500);

    const { data: versions, error: vErr } = await admin
      .from("plan_versions")
      .select("plan_id, version, status")
      .eq("status", "active")
      .order("plan_id", { ascending: true });

    expect(vErr).toBeNull();
    expect(versions).toHaveLength(3);
    expect(versions?.every((v: { version: number }) => v.version === 1)).toBe(
      true
    );
  });

  it("seeds entitlements matching TypeScript defaults", async () => {
    const admin = adminClient();
    const { data: rows, error } = await admin
      .from("plan_entitlements")
      .select(
        "plan_version_id, auto_monthly_turns, unlimited_auto, frontier_monthly_turns, attachments, storage_bytes, byok, voice, elevated_limits, model_families, plan_versions!inner(plan_id, status)"
      );

    expect(error).toBeNull();
    expect(rows).toHaveLength(3);

    type EntitlementSeedRow = {
      plan_version_id: string;
      auto_monthly_turns: number | null;
      unlimited_auto: boolean;
      frontier_monthly_turns: number | null;
      attachments: boolean;
      storage_bytes: number | string;
      byok: boolean;
      voice: boolean;
      elevated_limits: boolean;
      model_families: string[];
      plan_versions:
        | { plan_id: string; status: string }
        | { plan_id: string; status: string }[];
    };

    const byPlan = new Map<string, EntitlementSeedRow>();
    for (const row of (rows ?? []) as EntitlementSeedRow[]) {
      const joined = Array.isArray(row.plan_versions)
        ? row.plan_versions[0]
        : row.plan_versions;
      expect(joined?.status).toBe("active");
      byPlan.set(joined!.plan_id, row);
    }

    const free = byPlan.get("free")!;
    expect(free.auto_monthly_turns).toBe(PLAN_ENTITLEMENTS.free.autoMonthlyTurns);
    expect(free.unlimited_auto).toBe(false);
    expect(free.attachments).toBe(false);
    expect(Number(free.storage_bytes)).toBe(0);
    expect(free.byok).toBe(false);
    expect(free.model_families).toEqual([]);

    const lite = byPlan.get("lite")!;
    expect(lite.auto_monthly_turns).toBeNull();
    expect(lite.unlimited_auto).toBe(true);
    expect(lite.frontier_monthly_turns).toBe(10);
    expect(Number(lite.storage_bytes)).toBe(100 * 1024 * 1024);
    expect(lite.model_families).toEqual([
      "openai",
      "anthropic",
      "google",
      "meta",
    ]);

    const pro = byPlan.get("pro")!;
    expect(pro.frontier_monthly_turns).toBeNull();
    expect(pro.byok).toBe(true);
    expect(pro.voice).toBe(true);
    expect(pro.elevated_limits).toBe(true);
    expect(Number(pro.storage_bytes)).toBe(5 * 1024 * 1024 * 1024);
    expect(pro.model_families).toEqual([
      "openai",
      "anthropic",
      "google",
      "meta",
    ]);
  });

  it("loads catalog from DB and keeps sync helpers behavior-compatible", async () => {
    const catalog = await loadPlanCatalogFromDatabase();
    expect(catalog.source).toBe("database");
    expect(catalog.fallbackPlanIds).toEqual([]);
    expect(catalog.entitlements.free).toEqual(PLAN_ENTITLEMENTS.free);
    expect(catalog.entitlements.lite).toEqual(PLAN_ENTITLEMENTS.lite);
    expect(catalog.entitlements.pro).toEqual(PLAN_ENTITLEMENTS.pro);
    expect(catalog.plans.lite.amountEurCentsMonthly).toBe(
      SUBSCRIPTION_PLANS.find((p) => p.id === "lite")!.amountEurCentsMonthly
    );

    await ensurePlanConfigLoaded({ force: true });
    expect(entitlementsForPlan("free").autoMonthlyTurns).toBe(30);
    expect(entitlementsForPlan("pro").byok).toBe(true);
    expect(entitlementsForPlan("unknown-plan").planId).toBe("free");
  });

  it("allows authenticated select but blocks writes", async () => {
    const admin = adminClient();
    const select = await user.client.from("plans").select("id").order("id");
    expect(select.error).toBeNull();
    expect(select.data?.map((r) => r.id)).toEqual(["free", "lite", "pro"]);

    const insert = await user.client.from("plans").insert({
      id: "hacker",
      label: "Hacker",
      purpose: "should fail",
      amount_eur_cents_monthly: 0,
      features: ["x"],
    });
    expect(insert.error).not.toBeNull();

    const update = await user.client
      .from("plans")
      .update({ label: "Owned" })
      .eq("id", "free");
    expect(update.error).not.toBeNull();

    const { data: stillFree } = await admin
      .from("plans")
      .select("label")
      .eq("id", "free")
      .single();
    expect(stillFree?.label).toBe("Free");
  });

  it("falls back to TypeScript defaults when active entitlements are removed", async () => {
    const admin = adminClient();
    const { data: proVersion } = await admin
      .from("plan_versions")
      .select("id")
      .eq("plan_id", "pro")
      .eq("status", "active")
      .single();
    expect(proVersion?.id).toBeTruthy();

    const { error: delErr } = await admin
      .from("plan_entitlements")
      .delete()
      .eq("plan_version_id", proVersion!.id);
    expect(delErr).toBeNull();

    try {
      const catalog = await loadPlanCatalogFromDatabase();
      expect(catalog.fallbackPlanIds).toContain("pro");
      // Missing Pro entitlements must not invent more access than defaults —
      // defaults themselves are the safe known Pro gates.
      expect(catalog.entitlements.pro).toEqual(PLAN_ENTITLEMENTS.pro);
      expect(catalog.entitlements.free.byok).toBe(false);
    } finally {
      // Restore seed row so later suites / re-runs stay green.
      const { error: restoreErr } = await admin
        .from("plan_entitlements")
        .insert({
          plan_version_id: proVersion!.id,
          auto_monthly_turns: null,
          unlimited_auto: true,
          auto_fair_use_daily_credits: 200_000,
          auto_fair_use_period_credits: 2_000_000,
          frontier_monthly_turns: null,
          max_frontier_credits_per_turn: 50_000,
          frontier_soft_credit_cap: 400_000,
          frontier_heavy_ratio: 0.8,
          attachments: true,
          storage_bytes: 5 * 1024 * 1024 * 1024,
          byok: true,
          voice: true,
          elevated_limits: true,
        });
      expect(restoreErr).toBeNull();
    }
  });
});
