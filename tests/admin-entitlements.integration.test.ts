import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";
import { assertIntegrationEnv } from "./setup-env";
import { setUserRole } from "../src/lib/admin/auth";
import {
  createEntitlementGrant,
  createPlanSimulation,
  endPlanSimulation,
  revokeEntitlementGrant,
} from "../src/lib/billing/admin-entitlements";
import { getPlanUsageSnapshot } from "../src/lib/billing/plan-usage";
import { ensureFreeSubscription } from "../src/lib/billing/ensure-free";
import { getCreditBalance } from "../src/lib/inference/credits";
import { countsAsPaidRevenue } from "../src/lib/billing/entitlement-resolution";

let subject: TestUser;
let actor: TestUser;

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

  subject = await createTestUser();
  actor = await createTestUser();
  await setUserRole(actor.id, "admin");
  await ensureFreeSubscription(subject.id);
});

afterAll(async () => {
  if (subject) await deleteTestUser(subject.id).catch(() => {});
  if (actor) await deleteTestUser(actor.id).catch(() => {});
});

describe("admin entitlement overrides (integration)", () => {
  it("blocks authenticated clients from writing grants or simulations", async () => {
    const grantInsert = await subject.client
      .from("admin_entitlement_grants")
      .insert({
        user_id: subject.id,
        plan_id: "pro",
        reason: "should fail",
        created_by: subject.id,
      });
    expect(grantInsert.error).not.toBeNull();

    const simInsert = await subject.client.from("admin_plan_simulations").insert({
      user_id: subject.id,
      plan_id: "lite",
      reason: "should fail",
      created_by: subject.id,
    });
    expect(simInsert.error).not.toBeNull();
  });

  it("applies grant over Free, records audit, and excludes revenue", async () => {
    const beforeCredits = await getCreditBalance(subject.id);
    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const grant = await createEntitlementGrant({
      userId: subject.id,
      planId: "pro",
      endsAt,
      autoTurnBonus: 0,
      frontierTurnBonus: 0,
      creditBonus: 500,
      storageBytesOverride: 2_000_000,
      featureOverrides: { byok: true },
      reason: "hosted product demo",
      createdBy: actor.id,
    });

    expect(grant.excludeFromRevenue).toBe(true);

    const snap = await getPlanUsageSnapshot(subject.id);
    expect(snap.entitlementSource).toBe("admin_grant");
    expect(snap.planId).toBe("pro");
    expect(snap.isDemo).toBe(true);
    expect(snap.excludeFromRevenue).toBe(true);
    expect(snap.showDemoSubscriptionBanner).toBe(true);
    expect(snap.entitlements.byok).toBe(true);
    expect(snap.entitlements.storageBytes).toBe(2_000_000);
    expect(
      countsAsPaidRevenue({
        source: snap.entitlementSource,
        planId: snap.planId as "pro",
        excludeFromRevenue: snap.excludeFromRevenue,
      })
    ).toBe(false);

    const afterCredits = await getCreditBalance(subject.id);
    expect(afterCredits).toBe(beforeCredits + 500);

    const admin = adminClient();
    const { data: audits } = await admin
      .from("admin_audit_log")
      .select("action, target_id, metadata")
      .eq("actor_user_id", actor.id)
      .eq("action", "admin.entitlement_grant.create")
      .eq("target_id", grant.id)
      .limit(1);
    expect(audits).toHaveLength(1);
    expect((audits![0].metadata as { excludeFromRevenue?: boolean }).excludeFromRevenue).toBe(
      true
    );

    await revokeEntitlementGrant(grant.id, actor.id, "demo ended");
    const afterRevoke = await getPlanUsageSnapshot(subject.id);
    expect(afterRevoke.entitlementSource).toBe("free");
    expect(afterRevoke.showDemoSubscriptionBanner).toBe(false);
  });

  it("prefers active simulation over grant and real subscription", async () => {
    const admin = adminClient();
    await admin.from("subscriptions").upsert({
      user_id: subject.id,
      plan_id: "lite",
      status: "active",
      stripe_subscription_id: `sub_test_${subject.id.slice(0, 8)}`,
      current_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      cancel_at_period_end: false,
    });

    const grant = await createEntitlementGrant({
      userId: subject.id,
      planId: "pro",
      reason: "should lose to simulation",
      createdBy: actor.id,
    });

    const simulation = await createPlanSimulation({
      userId: subject.id,
      planId: "free",
      autoTurnBonus: 15,
      frontierTurnBonus: 3,
      reason: "reproduce free-tier bug",
      createdBy: actor.id,
    });

    const snap = await getPlanUsageSnapshot(subject.id);
    expect(snap.entitlementSource).toBe("plan_simulation");
    expect(snap.planId).toBe("free");
    expect(snap.entitlements.autoMonthlyTurns).toBe(45);
    expect(snap.entitlements.frontierMonthlyTurns).toBe(3);
    expect(snap.isDemo).toBe(true);
    expect(snap.excludeFromRevenue).toBe(true);

    await endPlanSimulation(simulation.id, actor.id);
    const afterEnd = await getPlanUsageSnapshot(subject.id);
    expect(afterEnd.entitlementSource).toBe("admin_grant");
    expect(afterEnd.planId).toBe("pro");

    await revokeEntitlementGrant(grant.id, actor.id);
    const afterGrant = await getPlanUsageSnapshot(subject.id);
    expect(afterGrant.entitlementSource).toBe("subscription");
    expect(afterGrant.planId).toBe("lite");
    expect(afterGrant.isDemo).toBe(false);
    expect(afterGrant.excludeFromRevenue).toBe(false);
    expect(
      countsAsPaidRevenue({
        source: afterGrant.entitlementSource,
        planId: afterGrant.planId as "lite",
        excludeFromRevenue: afterGrant.excludeFromRevenue,
      })
    ).toBe(true);

    // Reset subscription so later suites / users stay Free-shaped.
    await admin
      .from("subscriptions")
      .update({
        plan_id: "free",
        status: "active",
        stripe_subscription_id: null,
        current_period_end: null,
      })
      .eq("user_id", subject.id);
  });
});
