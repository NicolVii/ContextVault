import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";
import { assertIntegrationEnv } from "./setup-env";
import { getUserRole, setUserRole } from "../src/lib/admin/auth";
import { recordAdminAudit } from "../src/lib/admin/audit";
import { evaluateRoleAccess } from "../src/lib/admin/roles";

let normal: TestUser;
let adminUser: TestUser;
let superUser: TestUser;

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
  adminUser = await createTestUser();
  superUser = await createTestUser();
  await setUserRole(adminUser.id, "admin");
  await setUserRole(superUser.id, "super_admin");
});

afterAll(async () => {
  if (normal) await deleteTestUser(normal.id).catch(() => {});
  if (adminUser) await deleteTestUser(adminUser.id).catch(() => {});
  if (superUser) await deleteTestUser(superUser.id).catch(() => {});
});

describe("user_roles provisioning + RLS", () => {
  it("auto-creates a user role row for new accounts", async () => {
    const { data, error } = await normal.client
      .from("user_roles")
      .select("role")
      .eq("user_id", normal.id)
      .single();
    expect(error).toBeNull();
    expect(data?.role).toBe("user");
  });

  it("lets a user read only their own role", async () => {
    const { data } = await normal.client
      .from("user_roles")
      .select("user_id, role")
      .eq("user_id", adminUser.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("prevents authenticated users from elevating themselves", async () => {
    const { error } = await normal.client
      .from("user_roles")
      .update({ role: "super_admin" })
      .eq("user_id", normal.id);
    expect(error).not.toBeNull();

    const role = await getUserRole(normal.id);
    expect(role).toBe("user");
  });

  it("prevents authenticated inserts into admin_audit_log", async () => {
    const { error } = await normal.client.from("admin_audit_log").insert({
      actor_user_id: normal.id,
      action: "should.fail",
    });
    expect(error).not.toBeNull();
  });
});

describe("server-side role helpers", () => {
  it("loads database roles for admin and super_admin", async () => {
    expect(await getUserRole(normal.id)).toBe("user");
    expect(await getUserRole(adminUser.id)).toBe("admin");
    expect(await getUserRole(superUser.id)).toBe("super_admin");
  });

  it("maps roles to /admin and super-only API policy", () => {
    expect(evaluateRoleAccess(true, "user", "support")).toBe("forbidden");
    expect(evaluateRoleAccess(true, "admin", "support")).toBe("allow");
    expect(evaluateRoleAccess(true, "admin", "super_admin")).toBe("forbidden");
    expect(evaluateRoleAccess(true, "super_admin", "super_admin")).toBe(
      "allow"
    );
  });

  it("records admin audit entries via service role", async () => {
    await recordAdminAudit({
      actorUserId: superUser.id,
      action: "admin.test_action",
      targetType: "test",
      targetId: superUser.id,
      metadata: { suite: "admin-auth.integration" },
    });

    const admin = adminClient();
    const { data, error } = await admin
      .from("admin_audit_log")
      .select("action, actor_user_id, metadata")
      .eq("actor_user_id", superUser.id)
      .eq("action", "admin.test_action")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(error).toBeNull();
    expect(data?.[0]?.action).toBe("admin.test_action");
    expect(data?.[0]?.metadata).toMatchObject({
      suite: "admin-auth.integration",
    });
  });
});
