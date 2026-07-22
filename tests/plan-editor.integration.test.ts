import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ALL_MODEL_FAMILIES,
  PLAN_ENTITLEMENTS,
} from "../src/lib/billing/plan-defaults";
import {
  clearPlanConfigCache,
  ensurePlanConfigLoaded,
} from "../src/lib/billing";
import {
  createPlanCampaignOverride,
  getAdminPlanDetail,
  listAdminPlans,
  publishPlanVersion,
  revokePlanCampaignOverride,
  rollbackPlanVersion,
} from "../src/lib/billing/plan-editor";
import { entitlementsForPlan } from "../src/lib/billing/entitlements";

const run = process.env.CV_INTEGRATION === "1";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

describe.skipIf(!run)("admin plan editor integration", () => {
  let admin: SupabaseClient;
  let actorUserId: string;

  beforeAll(async () => {
    admin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const email = `plan-editor-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "plan-editor-test-password-123",
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("no user");
    actorUserId = data.user.id;

    await admin.from("user_roles").upsert({
      user_id: actorUserId,
      role: "super_admin",
    });
  });

  afterAll(async () => {
    clearPlanConfigCache();
    if (actorUserId) {
      await admin.auth.admin.deleteUser(actorUserId);
    }
  });

  it("lists Free / Lite / Pro for the editor", async () => {
    const plans = await listAdminPlans();
    expect(plans.map((p) => p.planId)).toEqual(["free", "lite", "pro"]);
    expect(plans.every((p) => p.activeVersion === 1 || p.activeVersion! >= 1)).toBe(
      true
    );
  });

  it("publishes a version with reason, audits, and supports rollback", async () => {
    const before = await getAdminPlanDetail("lite");
    const baseVersion = before.activeVersion!;
    expect(baseVersion.entitlements.frontierMonthlyTurns).toBe(10);

    const published = await publishPlanVersion({
      planId: "lite",
      product: {
        ...before.product,
        features: [...before.product.features],
      },
      entitlements: {
        ...baseVersion.entitlements,
        frontierMonthlyTurns: 12,
        modelFamilies: [...ALL_MODEL_FAMILIES],
      },
      reason: "Integration test: bump Lite Frontier to 12",
      actorUserId,
    });

    expect(published.version).toBeGreaterThan(baseVersion.version);
    expect(published.entitlements.frontierMonthlyTurns).toBe(12);
    expect(published.changeReason).toContain("bump Lite Frontier");

    const { data: audits } = await admin
      .from("admin_audit_log")
      .select("action, target_id, metadata")
      .eq("action", "admin.plan_version.publish")
      .eq("target_id", "lite")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(audits?.[0]?.metadata).toMatchObject({
      reason: "Integration test: bump Lite Frontier to 12",
    });

    clearPlanConfigCache();
    await ensurePlanConfigLoaded({ force: true });
    expect(entitlementsForPlan("lite").frontierMonthlyTurns).toBe(12);

    const rolled = await rollbackPlanVersion({
      planId: "lite",
      toVersionId: baseVersion.id,
      reason: "Integration test rollback to launch Lite",
      actorUserId,
    });
    expect(rolled.entitlements.frontierMonthlyTurns).toBe(10);

    clearPlanConfigCache();
    await ensurePlanConfigLoaded({ force: true });
    expect(entitlementsForPlan("lite").frontierMonthlyTurns).toBe(10);
  });

  it("creates a temporary campaign that raises Frontier turns", async () => {
    const startsAt = new Date(Date.now() - 60_000).toISOString();
    const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const campaign = await createPlanCampaignOverride({
      planId: "lite",
      name: "Lite Frontier boost test",
      reason: "Integration test temporary Frontier boost",
      startsAt,
      endsAt,
      entitlementOverrides: { frontierMonthlyTurns: 25 },
      actorUserId,
    });
    expect(campaign.active).toBe(true);

    clearPlanConfigCache();
    await ensurePlanConfigLoaded({ force: true });
    expect(entitlementsForPlan("lite").frontierMonthlyTurns).toBe(25);
    // Permanent plan version still 10 underneath; campaign overlays at load time.
    expect(PLAN_ENTITLEMENTS.lite.frontierMonthlyTurns).toBe(10);

    await revokePlanCampaignOverride({
      id: campaign.id,
      reason: "Integration test end campaign",
      actorUserId,
    });

    clearPlanConfigCache();
    await ensurePlanConfigLoaded({ force: true });
    expect(entitlementsForPlan("lite").frontierMonthlyTurns).toBe(10);
  });

  it("rejects publish without a reason", async () => {
    const detail = await getAdminPlanDetail("free");
    await expect(
      publishPlanVersion({
        planId: "free",
        product: detail.product,
        entitlements: detail.activeVersion!.entitlements,
        reason: "no",
        actorUserId,
      })
    ).rejects.toThrow(/reason/i);
  });
});
