import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getSessionContext, type SessionContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  evaluateRoleAccess,
  hasMinRole,
  isAppRole,
  type AppRole,
} from "@/lib/admin/roles";

export interface AdminContext extends SessionContext {
  role: AppRole;
}

/**
 * Load the platform role for a user from user_roles (service role).
 * Missing rows default to "user" so absence never elevates privilege.
 */
export async function getUserRole(userId: string): Promise<AppRole> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getUserRole failed", error.message);
    return "user";
  }
  if (data && isAppRole(data.role)) return data.role;
  return "user";
}

/** Assign a platform role (service role only — never expose to clients). */
export async function setUserRole(
  userId: string,
  role: AppRole
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("user_roles").upsert(
    { user_id: userId, role },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`setUserRole failed: ${error.message}`);
}

/**
 * Resolve session + role when the caller meets `minimum`. Returns null when
 * unauthenticated or under-privileged (API handlers map to 401 / 403).
 */
export async function requireRole(
  minimum: AppRole
): Promise<AdminContext | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const role = await getUserRole(ctx.user.id);
  if (!hasMinRole(role, minimum)) return null;
  return { ...ctx, role };
}

export async function requireStaff(): Promise<AdminContext | null> {
  return requireRole("support");
}

export async function requireAdmin(): Promise<AdminContext | null> {
  return requireRole("admin");
}

export async function requireSuperAdmin(): Promise<AdminContext | null> {
  return requireRole("super_admin");
}

/**
 * Page-level gate for /admin. Unauthenticated → login. Authenticated but not
 * staff → 404 (do not reveal the console to normal users).
 */
export async function requireStaffPage(): Promise<AdminContext> {
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect("/login?redirect=/admin");
  }
  const role = await getUserRole(ctx.user.id);
  if (!hasMinRole(role, "support")) {
    notFound();
  }
  return { ...ctx, role };
}

export function adminUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function adminForbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * API helper: require a minimum role. Distinguishes 401 (no session) from
 * 403 (signed in but insufficient role).
 */
export async function requireApiRole(
  minimum: AppRole
): Promise<
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse }
> {
  const session = await getSessionContext();
  const role = session ? await getUserRole(session.user.id) : null;
  const decision = evaluateRoleAccess(Boolean(session), role, minimum);
  if (decision === "unauthorized") {
    return { ok: false, response: adminUnauthorizedResponse() };
  }
  if (decision === "forbidden" || !session || !role) {
    return { ok: false, response: adminForbiddenResponse() };
  }
  return { ok: true, ctx: { ...session, role } };
}
