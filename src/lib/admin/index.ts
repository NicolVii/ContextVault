export {
  APP_ROLES,
  ROLE_RANK,
  evaluateRoleAccess,
  hasMinRole,
  isAdminRole,
  isAppRole,
  isStaffRole,
  isSuperAdminRole,
  type AppRole,
  type RoleAccessResult,
} from "@/lib/admin/roles";

export {
  adminForbiddenResponse,
  adminUnauthorizedResponse,
  getUserRole,
  requireAdmin,
  requireApiRole,
  requireRole,
  requireStaff,
  requireStaffPage,
  requireSuperAdmin,
  setUserRole,
  type AdminContext,
} from "@/lib/admin/auth";

export { recordAdminAudit } from "@/lib/admin/audit";
