/**
 * Admin Usage & Economics — server-side aggregation over usage ledgers.
 *
 * Returns summary JSON only. Raw usage events never leave this module.
 * Provider COGS and catalog MRR are estimates; Stripe Dashboard remains
 * the source of confirmed paid revenue.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAutoModelId } from "@/lib/billing/usage-intensity";
import { isPaidPlan } from "@/lib/billing/entitlements";
import { getSubscriptionPlan, formatEurCents } from "@/lib/billing/products";
import { MODEL_CATALOG } from "@/lib/inference/models";
import { KNOWN_PROVIDERS } from "@/lib/inference/provider-ops";

/** Max ledger rows scanned per query — keeps aggregations bounded. */
export const USAGE_ECONOMICS_SCAN_LIMIT = 25_000;

/** Illustrative USD→EUR rate for gross-margin sketches only. */
export const ILLUSTRATIVE_USD_TO_EUR = 0.92;

export type UsageAudienceFilter = "all" | "real" | "demo";
export type IntensityFilter = "all" | "auto" | "frontier";
export type BillingModeFilter = "all" | "platform" | "byok";

export interface AdminUsageFilterInput {
  /** Inclusive window start (ISO). Defaults to 30 days ago. */
  from?: string | null;
  /** Inclusive window end (ISO). Defaults to now. */
  to?: string | null;
  /** Convenience: last N days ending now (overrides from when set). */
  days?: number | null;
  planId?: string | null;
  provider?: string | null;
  modelId?: string | null;
  intensity?: IntensityFilter | string | null;
  billingMode?: BillingModeFilter | string | null;
  audience?: UsageAudienceFilter | string | null;
}

export interface AdminUsageFiltersApplied {
  from: string;
  to: string;
  days: number;
  planId: string | null;
  provider: string | null;
  modelId: string | null;
  intensity: IntensityFilter;
  billingMode: BillingModeFilter;
  audience: UsageAudienceFilter;
}

export interface NamedCount {
  key: string;
  label: string;
  count: number;
}

export interface NamedCost {
  key: string;
  label: string;
  requests: number;
  tokens: number;
  /** Estimated provider COGS (USD micros) from the price book. */
  estimatedCostUsdMicros: number;
}

export interface PlanEconomicsRow {
  planId: string;
  activeUsers: number;
  requests: number;
  /** Estimated platform COGS attributed to this plan (USD micros). */
  estimatedCostUsdMicros: number;
  /** estimatedCost / activeUsers (0 when no users). */
  estimatedCostPerUserUsdMicros: number;
  /** Catalog monthly list price × paid subs on this plan (EUR cents). */
  estimatedRevenueEurCents: number;
}

export interface AdminUsageEconomics {
  filters: AdminUsageFiltersApplied;
  users: {
    activeUsers: number;
    registrations: number;
    byPlan: NamedCount[];
  };
  turns: {
    auto: number;
    frontier: number;
    total: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
    avgPerTurn: number;
  };
  /** Context size proxied from input tokens (contextChars not persisted). */
  contextSize: {
    avgInputTokens: number | null;
    p50InputTokens: number | null;
    p90InputTokens: number | null;
    samples: number;
    note: string;
  };
  providers: NamedCost[];
  models: NamedCost[];
  latency: {
    avgMs: number | null;
    p50Ms: number | null;
    p90Ms: number | null;
    samples: number;
  };
  reliability: {
    errors: number;
    failovers: number;
    mockFallback: number;
    errorRate: number;
    opsEventSamples: number;
  };
  memory: {
    created: number;
    active: number;
    proposed: number;
  };
  documents: {
    created: number;
    ready: number;
    processing: number;
    failed: number;
  };
  storage: {
    totalBytes: number;
    documentCount: number;
  };
  economics: {
    /** Platform (non-mock) price-book COGS — not a provider invoice. */
    estimatedProviderCostUsdMicros: number;
    estimatedCostPerActiveUserUsdMicros: number;
    byPlan: PlanEconomicsRow[];
    /**
     * Catalog list price × active paid Stripe-style subscriptions.
     * Excludes demo grants/simulations. Not Stripe-confirmed cash.
     */
    estimatedRevenueEurCents: number;
    /**
     * Illustrative: estimatedRevenue − (platform COGS × FX).
     * Currencies mixed via ILLUSTRATIVE_USD_TO_EUR.
     */
    estimatedGrossMarginEurCents: number;
    /** Price-book cost on BYOK turns (user-paid provider; Cortaix avoided). */
    byokCostAvoidedUsdMicros: number;
    paidSubscriptionCount: number;
    disclaimer: string;
  };
  meta: {
    usageEventSamples: number;
    usageEventsTruncated: boolean;
    generatedAt: string;
  };
}

export interface UsageEventAggRow {
  user_id: string;
  model_id: string;
  provider: string;
  billing_mode: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  provider_cost_usd_micros: number | null;
  latency_ms: number | null;
  failover_count: number | null;
  created_at: string;
}

export interface OpsEventAggRow {
  provider: string;
  outcome: string;
  latency_ms: number | null;
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 30;
  return Math.min(Math.max(Math.floor(days), 1), 365);
}

function asIntensity(value: string | null | undefined): IntensityFilter {
  if (value === "auto" || value === "frontier") return value;
  return "all";
}

function asBillingMode(value: string | null | undefined): BillingModeFilter {
  if (value === "platform" || value === "byok") return value;
  return "all";
}

function asAudience(value: string | null | undefined): UsageAudienceFilter {
  if (value === "real" || value === "demo") return value;
  return "all";
}

/** Normalize filter input into a concrete applied window + facets. */
export function resolveUsageFilters(
  input: AdminUsageFilterInput = {}
): AdminUsageFiltersApplied {
  const to = input.to?.trim()
    ? new Date(input.to).toISOString()
    : new Date().toISOString();

  let from: string;
  let days: number;
  if (input.days != null && Number.isFinite(Number(input.days))) {
    days = clampDays(Number(input.days));
    from = new Date(
      new Date(to).getTime() - days * 24 * 60 * 60 * 1000
    ).toISOString();
  } else if (input.from?.trim()) {
    from = new Date(input.from).toISOString();
    days = Math.max(
      1,
      Math.ceil(
        (new Date(to).getTime() - new Date(from).getTime()) /
          (24 * 60 * 60 * 1000)
      )
    );
  } else {
    days = 30;
    from = daysAgoIso(30);
  }

  const planRaw = input.planId?.trim().toLowerCase() || null;
  const planId =
    planRaw && ["free", "lite", "pro"].includes(planRaw) ? planRaw : null;

  return {
    from,
    to,
    days,
    planId,
    provider: input.provider?.trim() || null,
    modelId: input.modelId?.trim() || null,
    intensity: asIntensity(input.intensity ?? null),
    billingMode: asBillingMode(input.billingMode ?? null),
    audience: asAudience(input.audience ?? null),
  };
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function formatUsdMicros(micros: number): string {
  if (!Number.isFinite(micros) || micros === 0) return "$0";
  const usd = micros / 1_000_000;
  if (Math.abs(usd) < 0.01) return usd < 0 ? ">-$0.01" : "<$0.01";
  const abs = Math.abs(usd).toFixed(usd < 1 ? 3 : 2);
  return usd < 0 ? `-$${abs}` : `$${abs}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  if (i === 0) return `${Math.round(n)} ${units[i]}`;
  const rounded = Math.round(n * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${label} ${units[i]}`;
}

export { formatEurCents };

const ECONOMICS_DISCLAIMER =
  "Estimated figures use the in-code price book and catalog list prices. " +
  "They are not provider invoices or Stripe-confirmed cash. " +
  "Gross margin applies an illustrative USD→EUR conversion. " +
  "Use Stripe Dashboard for paid revenue truth.";

function modelLabel(modelId: string): string {
  return MODEL_CATALOG.find((m) => m.id === modelId)?.displayName ?? modelId;
}

/**
 * Pure aggregation over already-fetched rows + dimension maps.
 * Exported for unit tests.
 */
export function aggregateUsageEconomics(input: {
  filters: AdminUsageFiltersApplied;
  events: UsageEventAggRow[];
  truncated: boolean;
  opsEvents: OpsEventAggRow[];
  planByUser: Map<string, string>;
  demoUserIds: Set<string>;
  registrations: number;
  usersByPlan: Map<string, number>;
  memory: { created: number; active: number; proposed: number };
  documents: {
    created: number;
    ready: number;
    processing: number;
    failed: number;
  };
  storage: { totalBytes: number; documentCount: number };
  paidSubsByPlan: Map<string, number>;
}): AdminUsageEconomics {
  const { filters } = input;
  const activeUsersSet = new Set<string>();
  const latencies: number[] = [];
  const inputTokenSamples: number[] = [];

  let autoTurns = 0;
  let frontierTurns = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let platformCost = 0;
  let byokAvoided = 0;

  const providerMap = new Map<string, NamedCost>();
  const modelMap = new Map<string, NamedCost>();
  const planCost = new Map<
    string,
    { users: Set<string>; requests: number; cost: number }
  >();

  const ensureProvider = (key: string): NamedCost => {
    let row = providerMap.get(key);
    if (!row) {
      row = {
        key,
        label: key,
        requests: 0,
        tokens: 0,
        estimatedCostUsdMicros: 0,
      };
      providerMap.set(key, row);
    }
    return row;
  };

  const ensureModel = (key: string): NamedCost => {
    let row = modelMap.get(key);
    if (!row) {
      row = {
        key,
        label: modelLabel(key),
        requests: 0,
        tokens: 0,
        estimatedCostUsdMicros: 0,
      };
      modelMap.set(key, row);
    }
    return row;
  };

  const ensurePlan = (planId: string) => {
    let row = planCost.get(planId);
    if (!row) {
      row = { users: new Set(), requests: 0, cost: 0 };
      planCost.set(planId, row);
    }
    return row;
  };

  for (const ev of input.events) {
    const userId = String(ev.user_id);
    const isDemo = input.demoUserIds.has(userId);
    if (filters.audience === "demo" && !isDemo) continue;
    if (filters.audience === "real" && isDemo) continue;

    const planId = input.planByUser.get(userId) ?? "free";
    if (filters.planId && planId !== filters.planId) continue;

    const provider = String(ev.provider);
    if (filters.provider && provider !== filters.provider) continue;

    const modelId = String(ev.model_id);
    if (filters.modelId && modelId !== filters.modelId) continue;

    const billingMode = String(ev.billing_mode);
    if (filters.billingMode !== "all" && billingMode !== filters.billingMode) {
      continue;
    }

    const intensity = isAutoModelId(modelId) ? "auto" : "frontier";
    if (filters.intensity !== "all" && intensity !== filters.intensity) {
      continue;
    }

    activeUsersSet.add(userId);
    if (intensity === "auto") autoTurns += 1;
    else frontierTurns += 1;

    const inTok = Number(ev.input_tokens ?? 0) || 0;
    const outTok = Number(ev.output_tokens ?? 0) || 0;
    const totTok =
      Number(ev.total_tokens ?? 0) ||
      (inTok + outTok > 0 ? inTok + outTok : 0);
    inputTokens += inTok;
    outputTokens += outTok;
    totalTokens += totTok;

    if (ev.input_tokens != null) {
      inputTokenSamples.push(Number(ev.input_tokens));
    }
    if (ev.latency_ms != null) {
      latencies.push(Number(ev.latency_ms));
    }

    const cost = Number(ev.provider_cost_usd_micros ?? 0) || 0;
    if (billingMode === "byok") {
      byokAvoided += cost;
    } else if (provider !== "mock") {
      platformCost += cost;
    }

    const pRow = ensureProvider(provider);
    pRow.requests += 1;
    pRow.tokens += totTok;
    if (billingMode === "platform" && provider !== "mock") {
      pRow.estimatedCostUsdMicros += cost;
    }

    const mRow = ensureModel(modelId);
    mRow.requests += 1;
    mRow.tokens += totTok;
    if (billingMode === "platform" && provider !== "mock") {
      mRow.estimatedCostUsdMicros += cost;
    }

    const planRow = ensurePlan(planId);
    planRow.users.add(userId);
    planRow.requests += 1;
    if (billingMode === "platform" && provider !== "mock") {
      planRow.cost += cost;
    }
  }

  let opsErrors = 0;
  let opsSuccess = 0;
  let failovers = 0;
  let mockFallback = 0;
  for (const op of input.opsEvents) {
    if (filters.provider && op.provider !== filters.provider) continue;
    const outcome = String(op.outcome);
    if (outcome === "failure") {
      opsErrors += 1;
    } else if (outcome === "success") {
      opsSuccess += 1;
    } else if (outcome === "failover") {
      failovers += 1;
    } else if (outcome === "mock_fallback") {
      mockFallback += 1;
      opsSuccess += 1;
    }
  }

  const denom = opsSuccess + opsErrors;
  const errorRate = denom === 0 ? 0 : opsErrors / denom;

  const sortedLat = [...latencies].sort((a, b) => a - b);
  const sortedCtx = [...inputTokenSamples].sort((a, b) => a - b);
  const avgLatency =
    sortedLat.length === 0
      ? null
      : Math.round(sortedLat.reduce((a, b) => a + b, 0) / sortedLat.length);
  const avgCtx =
    sortedCtx.length === 0
      ? null
      : Math.round(sortedCtx.reduce((a, b) => a + b, 0) / sortedCtx.length);

  const turnTotal = autoTurns + frontierTurns;
  const activeUsers = activeUsersSet.size;
  const costPerUser =
    activeUsers === 0 ? 0 : Math.round(platformCost / activeUsers);

  let estimatedRevenueEurCents = 0;
  let paidSubscriptionCount = 0;
  for (const [planId, count] of input.paidSubsByPlan) {
    if (!isPaidPlan(planId)) continue;
    const plan = getSubscriptionPlan(planId);
    const price = plan?.amountEurCentsMonthly ?? 0;
    estimatedRevenueEurCents += price * count;
    paidSubscriptionCount += count;
  }

  const costEurCents = Math.round(
    (platformCost / 1_000_000) * ILLUSTRATIVE_USD_TO_EUR * 100
  );
  const estimatedGrossMarginEurCents =
    estimatedRevenueEurCents - costEurCents;

  const byPlanEconomics: PlanEconomicsRow[] = [];
  const planIds = new Set<string>([
    ...input.usersByPlan.keys(),
    ...planCost.keys(),
    ...input.paidSubsByPlan.keys(),
    "free",
    "lite",
    "pro",
  ]);
  for (const planId of [...planIds].sort()) {
    const costRow = planCost.get(planId);
    const paid = input.paidSubsByPlan.get(planId) ?? 0;
    const plan = getSubscriptionPlan(planId);
    const revenue =
      isPaidPlan(planId) && plan
        ? plan.amountEurCentsMonthly * paid
        : 0;
    const users = costRow?.users.size ?? 0;
    const cost = costRow?.cost ?? 0;
    byPlanEconomics.push({
      planId,
      activeUsers: users,
      requests: costRow?.requests ?? 0,
      estimatedCostUsdMicros: cost,
      estimatedCostPerUserUsdMicros:
        users === 0 ? 0 : Math.round(cost / users),
      estimatedRevenueEurCents: revenue,
    });
  }

  const byPlanUsers: NamedCount[] = [...input.usersByPlan.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({
      key,
      label: key,
      count,
    }));

  const sortCost = (a: NamedCost, b: NamedCost) =>
    b.requests - a.requests || a.key.localeCompare(b.key);

  return {
    filters,
    users: {
      activeUsers,
      registrations: input.registrations,
      byPlan: byPlanUsers,
    },
    turns: {
      auto: autoTurns,
      frontier: frontierTurns,
      total: turnTotal,
    },
    tokens: {
      input: inputTokens,
      output: outputTokens,
      total: totalTokens,
      avgPerTurn:
        turnTotal === 0 ? 0 : Math.round(totalTokens / turnTotal),
    },
    contextSize: {
      avgInputTokens: avgCtx,
      p50InputTokens:
        percentile(sortedCtx, 0.5) == null
          ? null
          : Math.round(percentile(sortedCtx, 0.5)!),
      p90InputTokens:
        percentile(sortedCtx, 0.9) == null
          ? null
          : Math.round(percentile(sortedCtx, 0.9)!),
      samples: sortedCtx.length,
      note: "Proxied from usage_events.input_tokens (contextChars not stored).",
    },
    providers: [...providerMap.values()].sort(sortCost),
    models: [...modelMap.values()].sort(sortCost).slice(0, 40),
    latency: {
      avgMs: avgLatency,
      p50Ms:
        percentile(sortedLat, 0.5) == null
          ? null
          : Math.round(percentile(sortedLat, 0.5)!),
      p90Ms:
        percentile(sortedLat, 0.9) == null
          ? null
          : Math.round(percentile(sortedLat, 0.9)!),
      samples: sortedLat.length,
    },
    reliability: {
      errors: opsErrors,
      failovers,
      mockFallback,
      errorRate: Math.round(errorRate * 1000) / 1000,
      opsEventSamples: input.opsEvents.length,
    },
    memory: input.memory,
    documents: input.documents,
    storage: input.storage,
    economics: {
      estimatedProviderCostUsdMicros: platformCost,
      estimatedCostPerActiveUserUsdMicros: costPerUser,
      byPlan: byPlanEconomics,
      estimatedRevenueEurCents,
      estimatedGrossMarginEurCents,
      byokCostAvoidedUsdMicros: byokAvoided,
      paidSubscriptionCount,
      disclaimer: ECONOMICS_DISCLAIMER,
    },
    meta: {
      usageEventSamples: input.events.length,
      usageEventsTruncated: input.truncated,
      generatedAt: new Date().toISOString(),
    },
  };
}

async function loadDemoUserIds(): Promise<Set<string>> {
  const admin = createSupabaseAdminClient();
  const [grants, sims] = await Promise.all([
    admin
      .from("admin_entitlement_grants")
      .select("user_id")
      .is("revoked_at", null),
    admin
      .from("admin_plan_simulations")
      .select("user_id")
      .is("revoked_at", null),
  ]);
  const set = new Set<string>();
  for (const row of grants.data ?? []) {
    if (row.user_id) set.add(String(row.user_id));
  }
  for (const row of sims.data ?? []) {
    if (row.user_id) set.add(String(row.user_id));
  }
  return set;
}

/** Aggregate Usage & Economics for the admin console. */
export async function getAdminUsageEconomics(
  input: AdminUsageFilterInput = {}
): Promise<AdminUsageEconomics> {
  const filters = resolveUsageFilters(input);
  const admin = createSupabaseAdminClient();

  let usageQuery = admin
    .from("usage_events")
    .select(
      "user_id, model_id, provider, billing_mode, input_tokens, output_tokens, total_tokens, provider_cost_usd_micros, latency_ms, failover_count, created_at"
    )
    .gte("created_at", filters.from)
    .lte("created_at", filters.to)
    .order("created_at", { ascending: false })
    .limit(USAGE_ECONOMICS_SCAN_LIMIT);

  if (filters.provider) usageQuery = usageQuery.eq("provider", filters.provider);
  if (filters.modelId) usageQuery = usageQuery.eq("model_id", filters.modelId);
  if (filters.billingMode !== "all") {
    usageQuery = usageQuery.eq("billing_mode", filters.billingMode);
  }

  let opsQuery = admin
    .from("provider_ops_events")
    .select("provider, outcome, latency_ms")
    .gte("created_at", filters.from)
    .lte("created_at", filters.to)
    .limit(USAGE_ECONOMICS_SCAN_LIMIT);

  if (filters.provider) opsQuery = opsQuery.eq("provider", filters.provider);

  const [
    usageRes,
    opsRes,
    demoUserIds,
    subsRes,
    profilesRes,
    memCreatedRes,
    memActiveRes,
    memProposedRes,
    docsRes,
    docsReadyRes,
    docsProcessingRes,
    docsFailedRes,
    storageRes,
  ] = await Promise.all([
    usageQuery,
    opsQuery,
    loadDemoUserIds(),
    admin.from("subscriptions").select("user_id, plan_id, status"),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    admin
      .from("memories")
      .select("id", { count: "exact", head: true })
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    admin
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    admin
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("status", "proposed")
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "ready")
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing")
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    admin.from("documents").select("size_bytes"),
  ]);

  if (usageRes.error) throw usageRes.error;
  if (opsRes.error) throw opsRes.error;

  const events = (usageRes.data ?? []) as UsageEventAggRow[];
  const truncated = events.length >= USAGE_ECONOMICS_SCAN_LIMIT;

  const planByUser = new Map<string, string>();
  const usersByPlan = new Map<string, number>();
  const paidSubsByPlan = new Map<string, number>();

  for (const row of subsRes.data ?? []) {
    const userId = String(row.user_id);
    const planId = String(row.plan_id ?? "free");
    const status = String(row.status ?? "");
    planByUser.set(userId, planId);
    usersByPlan.set(planId, (usersByPlan.get(planId) ?? 0) + 1);

    const isDemo = demoUserIds.has(userId);
    if (
      !isDemo &&
      isPaidPlan(planId) &&
      (status === "active" || status === "trialing" || status === "past_due")
    ) {
      paidSubsByPlan.set(planId, (paidSubsByPlan.get(planId) ?? 0) + 1);
    }
  }

  const totalBytes = (storageRes.data ?? []).reduce(
    (n, d) => n + (Number(d.size_bytes) || 0),
    0
  );

  return aggregateUsageEconomics({
    filters,
    events,
    truncated,
    opsEvents: (opsRes.data ?? []) as OpsEventAggRow[],
    planByUser,
    demoUserIds,
    registrations: profilesRes.count ?? 0,
    usersByPlan,
    memory: {
      created: memCreatedRes.count ?? 0,
      active: memActiveRes.count ?? 0,
      proposed: memProposedRes.count ?? 0,
    },
    documents: {
      created: docsRes.count ?? 0,
      ready: docsReadyRes.count ?? 0,
      processing: docsProcessingRes.count ?? 0,
      failed: docsFailedRes.count ?? 0,
    },
    storage: {
      totalBytes,
      documentCount: (storageRes.data ?? []).length,
    },
    paidSubsByPlan,
  });
}

/** Filter option lists for the Usage dashboard UI. */
export function usageFilterOptions(): {
  days: number[];
  plans: string[];
  providers: string[];
  models: { id: string; label: string }[];
  intensities: IntensityFilter[];
  billingModes: BillingModeFilter[];
  audiences: UsageAudienceFilter[];
} {
  return {
    days: [7, 30, 90, 365],
    plans: ["free", "lite", "pro"],
    providers: [...KNOWN_PROVIDERS],
    models: MODEL_CATALOG.filter((m) => m.status === "active").map((m) => ({
      id: m.id,
      label: m.displayName,
    })),
    intensities: ["all", "auto", "frontier"],
    billingModes: ["all", "platform", "byok"],
    audiences: ["all", "real", "demo"],
  };
}
