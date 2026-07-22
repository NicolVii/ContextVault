/**
 * RLS hardening: normal authenticated users must not read or mutate admin /
 * commercial configuration tables (service_role only).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";
import { assertIntegrationEnv } from "./setup-env";
import { setUserRole } from "../src/lib/admin/auth";
import { recordAdminAudit } from "../src/lib/admin/audit";

let normal: TestUser;
let supportUser: TestUser;

/** Tables that must be opaque to authenticated clients (no SELECT policies). */
const ADMIN_CONFIG_TABLES = [
  "admin_audit_log",
  "admin_entitlement_grants",
  "admin_plan_simulations",
  "promotions",
  "system_operational_controls",
  "inference_providers",
  "inference_model_overrides",
  "billing_telemetry_events",
  "subscription_period_grants",
  "stripe_webhook_events",
  "plan_campaign_overrides",
] as const;

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

  normal = await createTestUser();
  supportUser = await createTestUser();
  await setUserRole(supportUser.id, "support");
});

afterAll(async () => {
  if (normal) await deleteTestUser(normal.id).catch(() => {});
  if (supportUser) await deleteTestUser(supportUser.id).catch(() => {});
});

describe("admin config RLS — normal users", () => {
  it("cannot SELECT admin / ops / commercial config tables", async () => {
    for (const table of ADMIN_CONFIG_TABLES) {
      const { data, error } = await normal.client.from(table).select("*").limit(5);
      // Either PostgREST permission error or empty under RLS — never rows.
      expect(
        error != null || (data ?? []).length === 0,
        `expected no readable rows from ${table}`
      ).toBe(true);
      expect((data ?? []).length, table).toBe(0);
    }
  });

  it("cannot INSERT into admin_audit_log", async () => {
    const { error } = await normal.client.from("admin_audit_log").insert({
      actor_user_id: normal.id,
      action: "admin.forge",
      target_type: "test",
    });
    expect(error).not.toBeNull();
  });

  it("cannot INSERT grants, simulations, or promotions", async () => {
    const grant = await normal.client.from("admin_entitlement_grants").insert({
      user_id: normal.id,
      plan_id: "pro",
      reason: "self grant",
      created_by: normal.id,
    });
    expect(grant.error).not.toBeNull();

    const sim = await normal.client.from("admin_plan_simulations").insert({
      user_id: normal.id,
      plan_id: "lite",
      reason: "self sim",
      created_by: normal.id,
    });
    expect(sim.error).not.toBeNull();

    const promo = await normal.client.from("promotions").insert({
      slug: `user-promo-${Date.now()}`,
      name: "User promo",
      status: "active",
      distribution: "public_code",
      code: "USERPROMO",
      starts_at: new Date().toISOString(),
      reason: "should fail",
      bonus_effect: { frontierTurnBonus: 1 },
    });
    expect(promo.error).not.toBeNull();
  });

  it("cannot mutate system_operational_controls", async () => {
    const update = await normal.client
      .from("system_operational_controls")
      .update({ enabled: true, reason: "hacked" })
      .eq("key", "maintenance_mode")
      .select("enabled");
    // RLS deny-all: error and/or zero returned rows.
    expect(
      update.error != null || (update.data ?? []).length === 0
    ).toBe(true);

    const admin = adminClient();
    const { data } = await admin
      .from("system_operational_controls")
      .select("enabled")
      .eq("key", "maintenance_mode")
      .maybeSingle();
    expect(data?.enabled).toBe(false);
  });

  it("cannot elevate own role even as support (no UPDATE policy)", async () => {
    const { error } = await supportUser.client
      .from("user_roles")
      .update({ role: "super_admin" })
      .eq("user_id", supportUser.id);
    expect(error).not.toBeNull();

    const { data } = await adminClient()
      .from("user_roles")
      .select("role")
      .eq("user_id", supportUser.id)
      .single();
    expect(data?.role).toBe("support");
  });

  it("cannot read other users' roles", async () => {
    const { data } = await normal.client
      .from("user_roles")
      .select("user_id, role")
      .eq("user_id", supportUser.id);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("admin audit logging via service role", () => {
  it("records an audit entry that authenticated clients still cannot read", async () => {
    await recordAdminAudit({
      actorUserId: supportUser.id,
      action: "admin.hardening.rls_check",
      targetType: "test",
      targetId: normal.id,
      metadata: { suite: "admin-config-rls" },
    });

    const admin = adminClient();
    const { data: rows, error } = await admin
      .from("admin_audit_log")
      .select("action, metadata")
      .eq("action", "admin.hardening.rls_check")
      .eq("actor_user_id", supportUser.id)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(error).toBeNull();
    expect(rows?.[0]?.action).toBe("admin.hardening.rls_check");

    const { data: asUser } = await normal.client
      .from("admin_audit_log")
      .select("*")
      .eq("action", "admin.hardening.rls_check");
    expect(asUser ?? []).toHaveLength(0);
  });
});
