import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/admin/auth";
import { isAppRole, type AppRole } from "@/lib/admin/roles";
import {
  listEntitlementGrantsForUser,
  listPlanSimulationsForUser,
} from "@/lib/billing/admin-entitlements";
import { getPlanUsageSnapshot } from "@/lib/billing/plan-usage";
import { getCreditBalance } from "@/lib/inference/credits";
import type { EntitlementOverrideInput } from "@/lib/billing/entitlement-resolution";
import type { PlanUsageSnapshot } from "@/lib/billing/plan-usage";

export interface AdminOverviewStats {
  users: {
    total: number;
    byRole: Record<AppRole, number>;
  };
  plans: {
    byPlanId: Record<string, number>;
    demoGrantsActive: number;
    simulationsActive: number;
  };
  usage: {
    autoTurnsPeriod: number;
    frontierTurnsPeriod: number;
    usageEvents30d: number;
  };
  mockFallback: {
    events30d: number;
    shareOfUsagePct: number;
  };
  failures: {
    documentsFailed: number;
    inferenceRestricted30d: number;
    paymentFailed30d: number;
  };
  generatedAt: string;
}

export interface AdminUserListItem {
  id: string;
  email: string | null;
  displayName: string | null;
  role: AppRole;
  planId: string;
  planStatus: string | null;
  createdAt: string | null;
}

export interface AdminUserDetail {
  profile: {
    id: string;
    email: string | null;
    displayName: string | null;
    persona: string | null;
    defaultModel: string | null;
    onboardingCompleted: boolean;
    role: AppRole;
    createdAt: string | null;
  };
  effectivePlan: PlanUsageSnapshot;
  subscription: {
    planId: string;
    status: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  } | null;
  demoGrants: EntitlementOverrideInput[];
  simulations: EntitlementOverrideInput[];
  usage: PlanUsageSnapshot;
  credits: {
    balance: number;
  };
  storage: {
    usedBytes: number;
    capBytes: number;
  };
  recentActivity: Array<{
    requestId: string;
    purpose: string;
    modelId: string;
    provider: string;
    creditsCharged: number;
    createdAt: string;
  }>;
  recentAudit: Array<{
    id: string;
    actorUserId: string | null;
    action: string;
    targetType: string | null;
    targetId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
}

export interface AdminAuditEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function emptyRoleCounts(): Record<AppRole, number> {
  return { user: 0, support: 0, admin: 0, super_admin: 0 };
}

/** Aggregate console overview statistics (service role). */
export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const admin = createSupabaseAdminClient();
  const periodStart = startOfUtcMonth().toISOString();
  const since30d = daysAgoIso(30);

  const [
    rolesRes,
    subsRes,
    usageRes,
    mockRes,
    usageCountRes,
    docsFailedRes,
    grantsRes,
    simsRes,
    telemetryRes,
  ] = await Promise.all([
    admin.from("user_roles").select("role"),
    admin.from("subscriptions").select("plan_id, status"),
    admin
      .from("plan_usage_periods")
      .select("auto_turns, frontier_turns")
      .eq("period_start", periodStart),
    admin
      .from("usage_events")
      .select("request_id", { count: "exact", head: true })
      .eq("provider", "mock")
      .gte("created_at", since30d),
    admin
      .from("usage_events")
      .select("request_id", { count: "exact", head: true })
      .gte("created_at", since30d),
    admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    admin
      .from("admin_entitlement_grants")
      .select("id", { count: "exact", head: true })
      .is("revoked_at", null),
    admin
      .from("admin_plan_simulations")
      .select("id", { count: "exact", head: true })
      .is("revoked_at", null),
    admin
      .from("billing_telemetry_events")
      .select("event_name")
      .in("event_name", ["inference_restricted", "payment_failed"])
      .gte("created_at", since30d),
  ]);

  const byRole = emptyRoleCounts();
  for (const row of rolesRes.data ?? []) {
    const role = row.role;
    if (isAppRole(role)) byRole[role] += 1;
  }

  const byPlanId: Record<string, number> = {};
  for (const row of subsRes.data ?? []) {
    const planId = String(row.plan_id ?? "free");
    byPlanId[planId] = (byPlanId[planId] ?? 0) + 1;
  }

  let autoTurnsPeriod = 0;
  let frontierTurnsPeriod = 0;
  for (const row of usageRes.data ?? []) {
    autoTurnsPeriod += Number(row.auto_turns ?? 0);
    frontierTurnsPeriod += Number(row.frontier_turns ?? 0);
  }

  const usageEvents30d = usageCountRes.count ?? 0;
  const mockEvents30d = mockRes.count ?? 0;
  const shareOfUsagePct =
    usageEvents30d > 0
      ? Math.round((mockEvents30d / usageEvents30d) * 1000) / 10
      : 0;

  let inferenceRestricted30d = 0;
  let paymentFailed30d = 0;
  for (const row of telemetryRes.data ?? []) {
    if (row.event_name === "inference_restricted") inferenceRestricted30d += 1;
    if (row.event_name === "payment_failed") paymentFailed30d += 1;
  }

  return {
    users: {
      total: (rolesRes.data ?? []).length,
      byRole,
    },
    plans: {
      byPlanId,
      demoGrantsActive: grantsRes.count ?? 0,
      simulationsActive: simsRes.count ?? 0,
    },
    usage: {
      autoTurnsPeriod,
      frontierTurnsPeriod,
      usageEvents30d,
    },
    mockFallback: {
      events30d: mockEvents30d,
      shareOfUsagePct,
    },
    failures: {
      documentsFailed: docsFailedRes.count ?? 0,
      inferenceRestricted30d,
      paymentFailed30d,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function loadAuthUserMap(
  userIds: string[]
): Promise<Map<string, { email: string | null; createdAt: string | null }>> {
  const map = new Map<
    string,
    { email: string | null; createdAt: string | null }
  >();
  if (userIds.length === 0) return map;

  const admin = createSupabaseAdminClient();
  // Prefer per-id lookup for small sets; fall back to list for bulk.
  if (userIds.length <= 40) {
    await Promise.all(
      userIds.map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id);
        map.set(id, {
          email: data.user?.email ?? null,
          createdAt: data.user?.created_at ?? null,
        });
      })
    );
    return map;
  }

  let page = 1;
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) {
      if (userIds.includes(u.id)) {
        map.set(u.id, {
          email: u.email ?? null,
          createdAt: u.created_at ?? null,
        });
      }
    }
    if (users.length < 200) break;
    page += 1;
    if (page > 50) break;
  }
  return map;
}

/** List users for the admin console, optionally filtered by q (email/name/id). */
export async function listAdminUsers(opts?: {
  q?: string;
  limit?: number;
}): Promise<AdminUserListItem[]> {
  const admin = createSupabaseAdminClient();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const q = opts?.q?.trim().toLowerCase() ?? "";

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, display_name, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const ids = (profiles ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];

  const [rolesRes, subsRes, authMap] = await Promise.all([
    admin.from("user_roles").select("user_id, role").in("user_id", ids),
    admin
      .from("subscriptions")
      .select("user_id, plan_id, status")
      .in("user_id", ids),
    loadAuthUserMap(ids),
  ]);

  const roleByUser = new Map<string, AppRole>();
  for (const row of rolesRes.data ?? []) {
    if (isAppRole(row.role)) roleByUser.set(row.user_id as string, row.role);
  }

  const subByUser = new Map<
    string,
    { planId: string; status: string | null }
  >();
  for (const row of subsRes.data ?? []) {
    subByUser.set(row.user_id as string, {
      planId: String(row.plan_id ?? "free"),
      status: (row.status as string | null) ?? null,
    });
  }

  let items: AdminUserListItem[] = (profiles ?? []).map((p) => {
    const id = p.id as string;
    const auth = authMap.get(id);
    const sub = subByUser.get(id);
    return {
      id,
      email: auth?.email ?? null,
      displayName: (p.display_name as string | null) ?? null,
      role: roleByUser.get(id) ?? "user",
      planId: sub?.planId ?? "free",
      planStatus: sub?.status ?? null,
      createdAt:
        (p.created_at as string | null) ?? auth?.createdAt ?? null,
    };
  });

  if (q) {
    items = items.filter((item) => {
      const hay = [item.id, item.email ?? "", item.displayName ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return items.slice(0, limit);
}

/** Full operator view of a single user. */
export async function getAdminUserDetail(
  userId: string
): Promise<AdminUserDetail | null> {
  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, persona, default_model, onboarding_completed, created_at")
    .eq("id", userId)
    .maybeSingle();

  const { data: authData } = await admin.auth.admin.getUserById(userId);
  if (!profile && !authData.user) return null;

  const [
    role,
    snap,
    grants,
    simulations,
    balance,
    docsRes,
    activityRes,
    auditRes,
    subRes,
    customerRes,
  ] = await Promise.all([
    getUserRole(userId),
    getPlanUsageSnapshot(userId),
    listEntitlementGrantsForUser(userId),
    listPlanSimulationsForUser(userId),
    getCreditBalance(userId),
    admin.from("documents").select("size_bytes").eq("user_id", userId),
    admin
      .from("usage_events")
      .select(
        "request_id, purpose, model_id, provider, credits_charged, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("admin_audit_log")
      .select("id, actor_user_id, action, target_type, target_id, metadata, created_at")
      .or(
        `target_id.eq.${userId},metadata->>userId.eq.${userId}`
      )
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("subscriptions")
      .select(
        "plan_id, status, current_period_end, cancel_at_period_end, stripe_subscription_id"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const usedBytes = (docsRes.data ?? []).reduce(
    (n, d) => n + (Number(d.size_bytes) || 0),
    0
  );

  return {
    profile: {
      id: userId,
      email: authData.user?.email ?? null,
      displayName: (profile?.display_name as string | null) ?? null,
      persona: (profile?.persona as string | null) ?? null,
      defaultModel: (profile?.default_model as string | null) ?? null,
      onboardingCompleted: Boolean(profile?.onboarding_completed),
      role,
      createdAt:
        (profile?.created_at as string | null) ??
        authData.user?.created_at ??
        null,
    },
    effectivePlan: snap,
    subscription: subRes.data
      ? {
          planId: String(subRes.data.plan_id ?? "free"),
          status: (subRes.data.status as string | null) ?? null,
          currentPeriodEnd:
            (subRes.data.current_period_end as string | null) ?? null,
          cancelAtPeriodEnd: Boolean(subRes.data.cancel_at_period_end),
          stripeCustomerId:
            (customerRes.data?.stripe_customer_id as string | null) ?? null,
          stripeSubscriptionId:
            (subRes.data.stripe_subscription_id as string | null) ?? null,
        }
      : null,
    demoGrants: grants,
    simulations,
    usage: snap,
    credits: { balance },
    storage: {
      usedBytes,
      capBytes: snap.entitlements.storageBytes,
    },
    recentActivity: (activityRes.data ?? []).map((row) => ({
      requestId: String(row.request_id),
      purpose: String(row.purpose),
      modelId: String(row.model_id),
      provider: String(row.provider),
      creditsCharged: Number(row.credits_charged ?? 0),
      createdAt: String(row.created_at),
    })),
    recentAudit: (auditRes.data ?? []).map((row) => ({
      id: String(row.id),
      actorUserId: (row.actor_user_id as string | null) ?? null,
      action: String(row.action),
      targetType: (row.target_type as string | null) ?? null,
      targetId: (row.target_id as string | null) ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: String(row.created_at),
    })),
  };
}

/** Browse admin_audit_log (newest first). */
export async function listAdminAuditEntries(opts?: {
  limit?: number;
  action?: string;
  targetUserId?: string;
}): Promise<AdminAuditEntry[]> {
  const admin = createSupabaseAdminClient();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);

  let query = admin
    .from("admin_audit_log")
    .select(
      "id, actor_user_id, action, target_type, target_id, metadata, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.action?.trim()) {
    query = query.eq("action", opts.action.trim());
  }
  if (opts?.targetUserId?.trim()) {
    const uid = opts.targetUserId.trim();
    query = query.or(`target_id.eq.${uid},metadata->>userId.eq.${uid}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    actorUserId: (row.actor_user_id as string | null) ?? null,
    action: String(row.action),
    targetType: (row.target_type as string | null) ?? null,
    targetId: (row.target_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }));
}
