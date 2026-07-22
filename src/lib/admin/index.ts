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

export {
  getAdminOverviewStats,
  listAdminUsers,
  getAdminUserDetail,
  listAdminAuditEntries,
  type AdminOverviewStats,
  type AdminUserListItem,
  type AdminUserDetail,
  type AdminAuditEntry,
} from "@/lib/admin/console";

export {
  getAdminUsageEconomics,
  resolveUsageFilters,
  usageFilterOptions,
  formatUsdMicros,
  formatBytes,
  type AdminUsageEconomics,
  type AdminUsageFilterInput,
  type AdminUsageFiltersApplied,
} from "@/lib/admin/usage-economics";

export {
  resetUserPlanUsage,
  grantAutoBonus,
  grantFrontierBonus,
  grantCreditBonus,
} from "@/lib/admin/mutations";

export {
  listAdminPlans,
  getAdminPlanDetail,
  publishPlanVersion,
  rollbackPlanVersion,
  createPlanCampaignOverride,
  revokePlanCampaignOverride,
} from "@/lib/billing/plan-editor";

export {
  listProviderAdminViews,
  updateProviderConfig,
  updateModelOverride,
  runProviderHealthTest,
  type ProviderAdminView,
  type ModelAdminView,
} from "@/lib/inference/provider-ops";

export {
  OPERATIONAL_CONTROL_KEYS,
  OPERATIONAL_CONTROL_META,
  OperationalControlError,
  assertCheckoutControlAllowed,
  assertFileUploadAllowed,
  assertMaintenanceAllowed,
  assertRegistrationAllowed,
  assertVoiceAllowed,
  ensureOperationalControlsSnapshot,
  evaluateControlActive,
  getControl,
  isControlActive,
  isModelShutDown,
  isOperationalControlKey,
  isProviderShutDown,
  isVoiceShutdownActive,
  listOperationalControls,
  operationalControlErrorResponse,
  updateOperationalControl,
  type OperationalControlKey,
  type OperationalControlState,
  type OperationalControlsSnapshot,
} from "@/lib/admin/system-controls";

export {
  getSystemHealthReport,
  type HealthCheckItem,
  type HealthStatus,
  type SystemHealthReport,
} from "@/lib/admin/system-health";
