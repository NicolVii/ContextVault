/**
 * Platform (Cortaix) application roles. Distinct from workspace_members.role.
 * Authorization must be enforced server-side against the user_roles table —
 * never via email allowlists or client-only checks alone.
 */

export const APP_ROLES = ["user", "support", "admin", "super_admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Higher number = more privilege. */
export const ROLE_RANK: Record<AppRole, number> = {
  user: 0,
  support: 1,
  admin: 2,
  super_admin: 3,
};

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" &&
    (APP_ROLES as readonly string[]).includes(value)
  );
}

export function hasMinRole(role: AppRole, minimum: AppRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Elevated staff who may enter the admin console (support and above). */
export function isStaffRole(role: AppRole): boolean {
  return hasMinRole(role, "support");
}

export function isAdminRole(role: AppRole): boolean {
  return hasMinRole(role, "admin");
}

export function isSuperAdminRole(role: AppRole): boolean {
  return role === "super_admin";
}

export type RoleAccessResult = "unauthorized" | "forbidden" | "allow";

/**
 * Pure authorization decision used by API/page gates (and unit tests).
 * Missing/unknown roles never elevate above "user".
 */
export function evaluateRoleAccess(
  authenticated: boolean,
  role: unknown,
  minimum: AppRole
): RoleAccessResult {
  if (!authenticated) return "unauthorized";
  const effective: AppRole = isAppRole(role) ? role : "user";
  if (!hasMinRole(effective, minimum)) return "forbidden";
  return "allow";
}
