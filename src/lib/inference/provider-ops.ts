/**
 * Provider operations — DB-backed config, health probes, and metrics.
 *
 * Security invariants:
 * - Never store, return, or log platform API keys or decrypted BYOK material.
 * - `configured` is a boolean derived from env key presence only.
 * - Health tests use platform env keys only; never user BYOK keys.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readOpenRouterApiKey } from "@/lib/ai";
import { recordAdminAudit } from "@/lib/admin/audit";
import { MODEL_CATALOG, type ModelProfile } from "./models";
import { getAdapter, listAdapters } from "./adapters";
import { providerCostUsdMicros } from "./pricing";

/** Aligns with billing Auto/Frontier cheap threshold. */
const AUTO_CHEAP_THRESHOLD = 0.7;

export const PROVIDER_OPS_CACHE_TTL_MS = 30_000;

export const KNOWN_PROVIDERS = [
  "openrouter",
  "openai",
  "anthropic",
  "google",
  "groq",
  "mock",
] as const;

export type KnownProviderId = (typeof KNOWN_PROVIDERS)[number];

export interface ProviderConfigRow {
  id: string;
  displayName: string;
  enabled: boolean;
  fallbackPriority: number;
  dailyCostCeilingUsdMicros: number | null;
  mockOnly: boolean;
  allowPlatform: boolean;
  allowByok: boolean;
  notes: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ModelOverrideRow {
  modelId: string;
  enabled: boolean;
  autoEligible: boolean;
  frontierEligible: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ProviderOpsSnapshot {
  providers: Map<string, ProviderConfigRow>;
  models: Map<string, ModelOverrideRow>;
  loadedAt: number;
}

export interface ProviderMetrics {
  requestCount: number;
  successCount: number;
  failureCount: number;
  errorRate: number;
  avgLatencyMs: number | null;
  estimatedCostUsdMicros: number;
  failoverCount: number;
  mockFallbackCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

export interface ProviderAdminView {
  id: string;
  displayName: string;
  configured: boolean;
  enabled: boolean;
  fallbackPriority: number;
  dailyCostCeilingUsdMicros: number | null;
  mockOnly: boolean;
  allowPlatform: boolean;
  allowByok: boolean;
  notes: string | null;
  supportedModels: {
    modelId: string;
    displayName: string;
    providerModelId: string;
  }[];
  metrics: ProviderMetrics;
  lastHealthCheck: {
    ok: boolean;
    latencyMs: number | null;
    errorClass: string | null;
    checkedAt: string;
  } | null;
  updatedAt: string | null;
}

export interface ModelAdminView {
  modelId: string;
  displayName: string;
  vendor: string;
  catalogStatus: ModelProfile["status"];
  enabled: boolean;
  autoEligible: boolean;
  frontierEligible: boolean;
  catalogAutoClass: boolean;
  catalogFrontierClass: boolean;
  bindings: { provider: string; providerModelId: string }[];
  updatedAt: string | null;
}

export type ProviderOpsEventOutcome =
  | "success"
  | "failure"
  | "failover"
  | "mock_fallback";

export type HealthErrorClass =
  | "key_not_configured"
  | "disabled"
  | "mock_only"
  | "timeout"
  | "auth"
  | "rate_limit"
  | "5xx"
  | "network"
  | "unknown";

const DEFAULT_PROVIDER_META: Record<
  string,
  { displayName: string; fallbackPriority: number; mockOnly: boolean }
> = {
  openrouter: { displayName: "OpenRouter", fallbackPriority: 10, mockOnly: false },
  openai: { displayName: "OpenAI", fallbackPriority: 20, mockOnly: false },
  anthropic: { displayName: "Anthropic", fallbackPriority: 30, mockOnly: false },
  google: { displayName: "Google", fallbackPriority: 40, mockOnly: false },
  groq: { displayName: "Groq", fallbackPriority: 50, mockOnly: false },
  mock: { displayName: "Mock fallback", fallbackPriority: 1000, mockOnly: true },
};

let snapshotCache: ProviderOpsSnapshot | null = null;

function defaultProviderRow(id: string): ProviderConfigRow {
  const meta = DEFAULT_PROVIDER_META[id] ?? {
    displayName: id,
    fallbackPriority: 100,
    mockOnly: id === "mock",
  };
  return {
    id,
    displayName: meta.displayName,
    enabled: true,
    fallbackPriority: meta.fallbackPriority,
    dailyCostCeilingUsdMicros: null,
    mockOnly: meta.mockOnly,
    allowPlatform: id !== "mock",
    allowByok: id !== "mock",
    notes: null,
    updatedAt: null,
    updatedBy: null,
  };
}

function defaultModelOverride(modelId: string): ModelOverrideRow {
  const profile = MODEL_CATALOG.find((m) => m.id === modelId);
  const cheap = profile?.suitability.cheap ?? 0;
  const isAuto = cheap >= AUTO_CHEAP_THRESHOLD;
  return {
    modelId,
    enabled: profile?.status === "active",
    autoEligible: isAuto,
    frontierEligible: !isAuto,
    updatedAt: null,
    updatedBy: null,
  };
}

function mapProviderRow(row: Record<string, unknown>): ProviderConfigRow {
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? row.id),
    enabled: Boolean(row.enabled),
    fallbackPriority: Number(row.fallback_priority ?? 100),
    dailyCostCeilingUsdMicros:
      row.daily_cost_ceiling_usd_micros == null
        ? null
        : Number(row.daily_cost_ceiling_usd_micros),
    mockOnly: Boolean(row.mock_only),
    allowPlatform: row.allow_platform !== false,
    allowByok: row.allow_byok !== false,
    notes: row.notes == null ? null : String(row.notes),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
  };
}

function mapModelOverride(row: Record<string, unknown>): ModelOverrideRow {
  return {
    modelId: String(row.model_id),
    enabled: Boolean(row.enabled),
    autoEligible: Boolean(row.auto_eligible),
    frontierEligible: Boolean(row.frontier_eligible),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
  };
}

/** Env key presence only — never returns key material. */
export function isProviderConfigured(provider: string): boolean {
  if (provider === "mock") return true;
  if (provider === "openrouter") {
    const pool = process.env.OPENROUTER_API_KEYS?.split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (pool && pool.length > 0) return true;
    return Boolean(readOpenRouterApiKey());
  }
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY?.trim());
  if (provider === "anthropic")
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (provider === "google") {
    return Boolean(
      process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim()
    );
  }
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY?.trim());
  return false;
}

/** Platform env key for health probes only — never BYOK. */
function platformKeyForHealth(provider: string): string | null {
  if (provider === "mock") return "mock";
  if (provider === "openrouter") {
    const pool = process.env.OPENROUTER_API_KEYS?.split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (pool && pool.length > 0) return pool[0]!;
    return readOpenRouterApiKey();
  }
  if (provider === "openai") return process.env.OPENAI_API_KEY?.trim() || null;
  if (provider === "anthropic")
    return process.env.ANTHROPIC_API_KEY?.trim() || null;
  if (provider === "google") {
    return (
      process.env.GOOGLE_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      null
    );
  }
  if (provider === "groq") return process.env.GROQ_API_KEY?.trim() || null;
  return null;
}

function emptySnapshot(): ProviderOpsSnapshot {
  const providers = new Map<string, ProviderConfigRow>();
  for (const id of listAdapters()) {
    providers.set(id, defaultProviderRow(id));
  }
  const models = new Map<string, ModelOverrideRow>();
  for (const m of MODEL_CATALOG) {
    models.set(m.id, defaultModelOverride(m.id));
  }
  return { providers, models, loadedAt: Date.now() };
}

export function getDefaultProviderOpsSnapshot(): ProviderOpsSnapshot {
  return emptySnapshot();
}

export function getCachedProviderOpsSnapshot(): ProviderOpsSnapshot | null {
  return snapshotCache;
}

export function setProviderOpsSnapshotCache(
  snapshot: ProviderOpsSnapshot | null
): void {
  snapshotCache = snapshot;
}

export function invalidateProviderOpsCache(): void {
  snapshotCache = null;
}

export function isProviderOpsCacheFresh(
  snapshot: ProviderOpsSnapshot | null = snapshotCache,
  now: number = Date.now(),
  ttlMs: number = PROVIDER_OPS_CACHE_TTL_MS
): boolean {
  if (!snapshot) return false;
  return now - snapshot.loadedAt < ttlMs;
}

export async function loadProviderOpsSnapshot(): Promise<ProviderOpsSnapshot> {
  const admin = createSupabaseAdminClient();
  const base = emptySnapshot();

  const [provRes, modelRes] = await Promise.all([
    admin.from("inference_providers").select("*"),
    admin.from("inference_model_overrides").select("*"),
  ]);

  if (!provRes.error && Array.isArray(provRes.data)) {
    for (const raw of provRes.data) {
      const row = mapProviderRow(raw as Record<string, unknown>);
      base.providers.set(row.id, row);
    }
  } else if (provRes.error) {
    console.error("loadProviderOpsSnapshot providers", provRes.error.message);
  }

  if (!modelRes.error && Array.isArray(modelRes.data)) {
    for (const raw of modelRes.data) {
      const row = mapModelOverride(raw as Record<string, unknown>);
      base.models.set(row.modelId, row);
    }
  } else if (modelRes.error) {
    console.error("loadProviderOpsSnapshot models", modelRes.error.message);
  }

  base.loadedAt = Date.now();
  snapshotCache = base;
  return base;
}

export async function ensureProviderOpsSnapshot(options?: {
  ttlMs?: number;
}): Promise<ProviderOpsSnapshot> {
  const ttlMs = options?.ttlMs ?? PROVIDER_OPS_CACHE_TTL_MS;
  if (isProviderOpsCacheFresh(snapshotCache, Date.now(), ttlMs) && snapshotCache) {
    return snapshotCache;
  }
  try {
    return await loadProviderOpsSnapshot();
  } catch (err) {
    console.error("ensureProviderOpsSnapshot failed", err);
    if (snapshotCache) return snapshotCache;
    const fallback = emptySnapshot();
    snapshotCache = fallback;
    return fallback;
  }
}

/** Sync read for hot path when cache is warm; else defaults. */
export function getProviderOpsSync(): ProviderOpsSnapshot {
  return snapshotCache ?? emptySnapshot();
}

export function getProviderConfig(
  provider: string,
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): ProviderConfigRow {
  return snapshot.providers.get(provider) ?? defaultProviderRow(provider);
}

export function getModelOverride(
  modelId: string,
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): ModelOverrideRow {
  return snapshot.models.get(modelId) ?? defaultModelOverride(modelId);
}

export function isModelEnabledForRouting(
  modelId: string,
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): boolean {
  const profile = MODEL_CATALOG.find((m) => m.id === modelId);
  if (!profile || profile.status !== "active") return false;
  return getModelOverride(modelId, snapshot).enabled;
}

export function isProviderEnabledForRouting(
  provider: string,
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): boolean {
  const cfg = getProviderConfig(provider, snapshot);
  return cfg.enabled && !cfg.mockOnly;
}

export function isProviderRunnable(
  provider: string,
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): boolean {
  const cfg = getProviderConfig(provider, snapshot);
  if (!cfg.enabled) return false;
  if (cfg.mockOnly) return false;
  return isProviderConfigured(provider);
}

/**
 * Sort bindings by ops fallback priority (lower first), preserving
 * relative order among equal priorities. Skips disabled / mock-only providers.
 */
export function filterAndOrderBindings<
  T extends { provider: string; providerModelId: string },
>(
  bindings: T[],
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): T[] {
  const runnable = bindings.filter((b) =>
    isProviderEnabledForRouting(b.provider, snapshot)
  );
  return [...runnable].sort((a, b) => {
    const pa = getProviderConfig(a.provider, snapshot).fallbackPriority;
    const pb = getProviderConfig(b.provider, snapshot).fallbackPriority;
    return pa - pb;
  });
}

export function getRoutableModels(
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): ModelProfile[] {
  return MODEL_CATALOG.filter((m) => {
    if (m.status !== "active") return false;
    return getModelOverride(m.id, snapshot).enabled;
  });
}

export function isModelAutoEligible(
  modelId: string,
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): boolean {
  return getModelOverride(modelId, snapshot).autoEligible;
}

export function isModelFrontierEligible(
  modelId: string,
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): boolean {
  return getModelOverride(modelId, snapshot).frontierEligible;
}

export async function recordProviderOpsEvent(params: {
  requestId?: string | null;
  provider: string;
  modelId?: string | null;
  providerModelId?: string | null;
  outcome: ProviderOpsEventOutcome;
  latencyMs?: number | null;
  errorClass?: string | null;
  costUsdMicros?: number;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("provider_ops_events").insert({
      request_id: params.requestId ?? null,
      provider: params.provider,
      model_id: params.modelId ?? null,
      provider_model_id: params.providerModelId ?? null,
      outcome: params.outcome,
      latency_ms: params.latencyMs ?? null,
      error_class: params.errorClass ?? null,
      cost_usd_micros: params.costUsdMicros ?? 0,
    });
    if (error) {
      console.error("provider_ops_events insert failed", error.message);
    }
  } catch (err) {
    console.error("provider_ops_events insert failed", err);
  }
}

function classifyHealthError(message: string): HealthErrorClass {
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("aborted")) return "timeout";
  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api")
  ) {
    return "auth";
  }
  if (lower.includes("429") || lower.includes("rate")) return "rate_limit";
  if (/\b5\d\d\b/.test(lower)) return "5xx";
  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econn")
  ) {
    return "network";
  }
  return "unknown";
}

function healthProbeModel(provider: string): string {
  const profile = MODEL_CATALOG.find((m) =>
    m.bindings.some((b) => b.provider === provider)
  );
  const binding = profile?.bindings.find((b) => b.provider === provider);
  if (binding) return binding.providerModelId;
  if (provider === "mock") return "mock";
  return "ping";
}

/**
 * Safe admin health probe. Uses platform env key only.
 * Never accepts, returns, or logs secrets / vendor response bodies.
 */
export async function runProviderHealthTest(params: {
  providerId: string;
  actorUserId: string;
}): Promise<{
  ok: boolean;
  latencyMs: number | null;
  errorClass: HealthErrorClass | null;
  configured: boolean;
}> {
  const snapshot = await ensureProviderOpsSnapshot();
  const cfg = getProviderConfig(params.providerId, snapshot);

  if (!KNOWN_PROVIDERS.includes(params.providerId as KnownProviderId)) {
    if (!listAdapters().includes(params.providerId)) {
      return {
        ok: false,
        latencyMs: null,
        errorClass: "unknown",
        configured: false,
      };
    }
  }

  if (!cfg.enabled) {
    await persistHealthCheck({
      provider: params.providerId,
      ok: false,
      latencyMs: null,
      errorClass: "disabled",
      actorUserId: params.actorUserId,
    });
    return {
      ok: false,
      latencyMs: null,
      errorClass: "disabled",
      configured: isProviderConfigured(params.providerId),
    };
  }

  if (cfg.mockOnly && params.providerId !== "mock") {
    await persistHealthCheck({
      provider: params.providerId,
      ok: false,
      latencyMs: null,
      errorClass: "mock_only",
      actorUserId: params.actorUserId,
    });
    return {
      ok: false,
      latencyMs: null,
      errorClass: "mock_only",
      configured: isProviderConfigured(params.providerId),
    };
  }

  const configured = isProviderConfigured(params.providerId);
  if (!configured) {
    await persistHealthCheck({
      provider: params.providerId,
      ok: false,
      latencyMs: null,
      errorClass: "key_not_configured",
      actorUserId: params.actorUserId,
    });
    await recordAdminAudit({
      actorUserId: params.actorUserId,
      action: "admin.provider.health_test",
      targetType: "provider",
      targetId: params.providerId,
      metadata: { ok: false, errorClass: "key_not_configured" },
    });
    return {
      ok: false,
      latencyMs: null,
      errorClass: "key_not_configured",
      configured: false,
    };
  }

  const apiKey = platformKeyForHealth(params.providerId);
  // apiKey is used only for the adapter call; never returned or audited.
  if (!apiKey) {
    await persistHealthCheck({
      provider: params.providerId,
      ok: false,
      latencyMs: null,
      errorClass: "key_not_configured",
      actorUserId: params.actorUserId,
    });
    return {
      ok: false,
      latencyMs: null,
      errorClass: "key_not_configured",
      configured: false,
    };
  }

  const adapter = getAdapter(params.providerId);
  if (!adapter) {
    return {
      ok: false,
      latencyMs: null,
      errorClass: "unknown",
      configured,
    };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  let ok = false;
  let errorClass: HealthErrorClass | null = null;
  try {
    // Tiny completion — do not settle usage or debit credits.
    await Promise.race([
      adapter.complete({
        model: healthProbeModel(params.providerId),
        messages: [{ role: "user", content: "ping" }],
        apiKey,
        temperature: 0,
      }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error("timeout"))
        );
      }),
    ]);
    ok = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    errorClass = classifyHealthError(message);
    ok = false;
  } finally {
    clearTimeout(timeout);
  }

  const latencyMs = Date.now() - started;

  await persistHealthCheck({
    provider: params.providerId,
    ok,
    latencyMs,
    errorClass,
    actorUserId: params.actorUserId,
  });

  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.provider.health_test",
    targetType: "provider",
    targetId: params.providerId,
    metadata: {
      ok,
      latencyMs,
      errorClass,
      // Never include apiKey, response body, or BYOK material.
    },
  });

  return { ok, latencyMs, errorClass, configured };
}

async function persistHealthCheck(params: {
  provider: string;
  ok: boolean;
  latencyMs: number | null;
  errorClass: HealthErrorClass | null;
  actorUserId: string;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("provider_health_checks").insert({
      provider: params.provider,
      ok: params.ok,
      latency_ms: params.latencyMs,
      error_class: params.errorClass,
      actor_user_id: params.actorUserId,
      meta: {},
    });
  } catch (err) {
    console.error("provider_health_checks insert failed", err);
  }
}

function emptyMetrics(): ProviderMetrics {
  return {
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    errorRate: 0,
    avgLatencyMs: null,
    estimatedCostUsdMicros: 0,
    failoverCount: 0,
    mockFallbackCount: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
  };
}

async function aggregateProviderMetrics(
  sinceIso: string
): Promise<Map<string, ProviderMetrics>> {
  const admin = createSupabaseAdminClient();
  const map = new Map<string, ProviderMetrics>();

  const ensure = (provider: string): ProviderMetrics => {
    let m = map.get(provider);
    if (!m) {
      m = emptyMetrics();
      map.set(provider, m);
    }
    return m;
  };

  const { data: opsEvents, error: opsErr } = await admin
    .from("provider_ops_events")
    .select(
      "provider, outcome, latency_ms, cost_usd_micros, created_at"
    )
    .gte("created_at", sinceIso)
    .limit(20_000);

  if (opsErr) {
    console.error("aggregateProviderMetrics ops", opsErr.message);
  } else if (opsEvents) {
    for (const raw of opsEvents) {
      const provider = String(raw.provider);
      const m = ensure(provider);
      const outcome = String(raw.outcome);
      const createdAt = String(raw.created_at);

      if (outcome === "success") {
        m.requestCount += 1;
        m.successCount += 1;
        if (!m.lastSuccessAt || createdAt > m.lastSuccessAt) {
          m.lastSuccessAt = createdAt;
        }
        if (raw.latency_ms != null) {
          const prev = m.avgLatencyMs ?? 0;
          const n = m.successCount;
          m.avgLatencyMs = prev + (Number(raw.latency_ms) - prev) / n;
        }
        m.estimatedCostUsdMicros += Number(raw.cost_usd_micros ?? 0);
      } else if (outcome === "failure") {
        m.requestCount += 1;
        m.failureCount += 1;
        if (!m.lastFailureAt || createdAt > m.lastFailureAt) {
          m.lastFailureAt = createdAt;
        }
      } else if (outcome === "failover") {
        m.failoverCount += 1;
      } else if (outcome === "mock_fallback") {
        m.mockFallbackCount += 1;
        m.requestCount += 1;
        m.successCount += 1;
        if (!m.lastSuccessAt || createdAt > m.lastSuccessAt) {
          m.lastSuccessAt = createdAt;
        }
      }
    }
  }

  // Supplement cost from usage_events when ops events lack cost (legacy rows).
  const { data: usage, error: usageErr } = await admin
    .from("usage_events")
    .select("provider, provider_cost_usd_micros, latency_ms, created_at")
    .gte("created_at", sinceIso)
    .limit(20_000);

  if (usageErr) {
    console.error("aggregateProviderMetrics usage", usageErr.message);
  } else if (usage && (!opsEvents || opsEvents.length === 0)) {
    for (const raw of usage) {
      const provider = String(raw.provider);
      const m = ensure(provider);
      m.requestCount += 1;
      m.successCount += 1;
      const createdAt = String(raw.created_at);
      if (!m.lastSuccessAt || createdAt > m.lastSuccessAt) {
        m.lastSuccessAt = createdAt;
      }
      m.estimatedCostUsdMicros += Number(raw.provider_cost_usd_micros ?? 0);
      if (raw.latency_ms != null) {
        const prev = m.avgLatencyMs ?? 0;
        const n = m.successCount;
        m.avgLatencyMs = prev + (Number(raw.latency_ms) - prev) / n;
      }
    }
  } else if (usage) {
    // Prefer ops cost when present; still fold usage cost for providers with
    // no ops success cost yet.
    for (const raw of usage) {
      const provider = String(raw.provider);
      const m = ensure(provider);
      if (m.estimatedCostUsdMicros === 0) {
        m.estimatedCostUsdMicros += Number(raw.provider_cost_usd_micros ?? 0);
      }
    }
  }

  // Latest health-check timestamps as fallback for last success/failure.
  const { data: health } = await admin
    .from("provider_health_checks")
    .select("provider, ok, checked_at")
    .order("checked_at", { ascending: false })
    .limit(500);

  if (health) {
    const seenSuccess = new Set<string>();
    const seenFailure = new Set<string>();
    for (const raw of health) {
      const provider = String(raw.provider);
      const m = ensure(provider);
      const checkedAt = String(raw.checked_at);
      if (raw.ok && !seenSuccess.has(provider)) {
        seenSuccess.add(provider);
        if (!m.lastSuccessAt || checkedAt > m.lastSuccessAt) {
          m.lastSuccessAt = checkedAt;
        }
      }
      if (!raw.ok && !seenFailure.has(provider)) {
        seenFailure.add(provider);
        if (!m.lastFailureAt || checkedAt > m.lastFailureAt) {
          m.lastFailureAt = checkedAt;
        }
      }
    }
  }

  for (const m of map.values()) {
    const denom = m.successCount + m.failureCount;
    m.errorRate = denom === 0 ? 0 : m.failureCount / denom;
    if (m.avgLatencyMs != null) {
      m.avgLatencyMs = Math.round(m.avgLatencyMs);
    }
  }

  return map;
}

export async function listProviderAdminViews(options?: {
  windowDays?: number;
}): Promise<{ providers: ProviderAdminView[]; models: ModelAdminView[] }> {
  const snapshot = await ensureProviderOpsSnapshot({ ttlMs: 0 });
  const days = options?.windowDays ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const metricsMap = await aggregateProviderMetrics(since);

  const admin = createSupabaseAdminClient();
  const { data: healthRows } = await admin
    .from("provider_health_checks")
    .select("provider, ok, latency_ms, error_class, checked_at")
    .order("checked_at", { ascending: false })
    .limit(200);

  const lastHealth = new Map<
    string,
    NonNullable<ProviderAdminView["lastHealthCheck"]>
  >();
  if (healthRows) {
    for (const raw of healthRows) {
      const id = String(raw.provider);
      if (lastHealth.has(id)) continue;
      lastHealth.set(id, {
        ok: Boolean(raw.ok),
        latencyMs: raw.latency_ms == null ? null : Number(raw.latency_ms),
        errorClass: raw.error_class == null ? null : String(raw.error_class),
        checkedAt: String(raw.checked_at),
      });
    }
  }

  const providerIds = new Set<string>([
    ...listAdapters(),
    ...snapshot.providers.keys(),
  ]);

  const providers: ProviderAdminView[] = [...providerIds]
    .map((id) => {
      const cfg = getProviderConfig(id, snapshot);
      const supportedModels = MODEL_CATALOG.filter((m) =>
        m.bindings.some((b) => b.provider === id)
      ).map((m) => {
        const binding = m.bindings.find((b) => b.provider === id)!;
        return {
          modelId: m.id,
          displayName: m.displayName,
          providerModelId: binding.providerModelId,
        };
      });

      return {
        id,
        displayName: cfg.displayName,
        configured: isProviderConfigured(id),
        enabled: cfg.enabled,
        fallbackPriority: cfg.fallbackPriority,
        dailyCostCeilingUsdMicros: cfg.dailyCostCeilingUsdMicros,
        mockOnly: cfg.mockOnly,
        allowPlatform: cfg.allowPlatform,
        allowByok: cfg.allowByok,
        notes: cfg.notes,
        supportedModels,
        metrics: metricsMap.get(id) ?? emptyMetrics(),
        lastHealthCheck: lastHealth.get(id) ?? null,
        updatedAt: cfg.updatedAt,
      };
    })
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority);

  const models: ModelAdminView[] = MODEL_CATALOG.map((m) => {
    const override = getModelOverride(m.id, snapshot);
    const catalogAuto = m.suitability.cheap >= AUTO_CHEAP_THRESHOLD;
    return {
      modelId: m.id,
      displayName: m.displayName,
      vendor: m.vendor,
      catalogStatus: m.status,
      enabled: override.enabled,
      autoEligible: override.autoEligible,
      frontierEligible: override.frontierEligible,
      catalogAutoClass: catalogAuto,
      catalogFrontierClass: !catalogAuto,
      bindings: m.bindings.map((b) => ({
        provider: b.provider,
        providerModelId: b.providerModelId,
      })),
      updatedAt: override.updatedAt,
    };
  });

  return { providers, models };
}

export interface UpdateProviderInput {
  enabled?: boolean;
  fallbackPriority?: number;
  dailyCostCeilingUsdMicros?: number | null;
  mockOnly?: boolean;
  allowPlatform?: boolean;
  allowByok?: boolean;
  notes?: string | null;
}

export async function updateProviderConfig(params: {
  providerId: string;
  patch: UpdateProviderInput;
  actorUserId: string;
  reason: string;
}): Promise<ProviderConfigRow> {
  if (!listAdapters().includes(params.providerId)) {
    throw new Error(`Unknown provider: ${params.providerId}`);
  }

  const admin = createSupabaseAdminClient();
  const existing = await ensureProviderOpsSnapshot({ ttlMs: 0 });
  const current = getProviderConfig(params.providerId, existing);

  const next = {
    id: params.providerId,
    display_name: current.displayName,
    enabled: params.patch.enabled ?? current.enabled,
    fallback_priority:
      params.patch.fallbackPriority ?? current.fallbackPriority,
    daily_cost_ceiling_usd_micros:
      params.patch.dailyCostCeilingUsdMicros !== undefined
        ? params.patch.dailyCostCeilingUsdMicros
        : current.dailyCostCeilingUsdMicros,
    mock_only: params.patch.mockOnly ?? current.mockOnly,
    allow_platform: params.patch.allowPlatform ?? current.allowPlatform,
    allow_byok: params.patch.allowByok ?? current.allowByok,
    notes:
      params.patch.notes !== undefined ? params.patch.notes : current.notes,
    updated_by: params.actorUserId,
  };

  const { data, error } = await admin
    .from("inference_providers")
    .upsert(next, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;

  invalidateProviderOpsCache();
  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.provider.update",
    targetType: "provider",
    targetId: params.providerId,
    metadata: {
      reason: params.reason,
      patch: params.patch,
      // Never include secrets.
    },
  });

  return mapProviderRow(data as Record<string, unknown>);
}

export interface UpdateModelOverrideInput {
  enabled?: boolean;
  autoEligible?: boolean;
  frontierEligible?: boolean;
}

export async function updateModelOverride(params: {
  modelId: string;
  patch: UpdateModelOverrideInput;
  actorUserId: string;
  reason: string;
}): Promise<ModelOverrideRow> {
  if (!MODEL_CATALOG.some((m) => m.id === params.modelId)) {
    throw new Error(`Unknown model: ${params.modelId}`);
  }

  const admin = createSupabaseAdminClient();
  const existing = await ensureProviderOpsSnapshot({ ttlMs: 0 });
  const current = getModelOverride(params.modelId, existing);

  const next = {
    model_id: params.modelId,
    enabled: params.patch.enabled ?? current.enabled,
    auto_eligible: params.patch.autoEligible ?? current.autoEligible,
    frontier_eligible:
      params.patch.frontierEligible ?? current.frontierEligible,
    updated_by: params.actorUserId,
  };

  const { data, error } = await admin
    .from("inference_model_overrides")
    .upsert(next, { onConflict: "model_id" })
    .select("*")
    .single();

  if (error) throw error;

  invalidateProviderOpsCache();
  await recordAdminAudit({
    actorUserId: params.actorUserId,
    action: "admin.model.override",
    targetType: "model",
    targetId: params.modelId,
    metadata: {
      reason: params.reason,
      patch: params.patch,
    },
  });

  return mapModelOverride(data as Record<string, unknown>);
}

/** Today's platform spend for a provider (ops events + usage). */
export async function getProviderDailyCostUsdMicros(
  provider: string
): Promise<number> {
  const admin = createSupabaseAdminClient();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const since = start.toISOString();

  const { data } = await admin
    .from("provider_ops_events")
    .select("cost_usd_micros")
    .eq("provider", provider)
    .eq("outcome", "success")
    .gte("created_at", since);

  if (data && data.length > 0) {
    return data.reduce((sum, row) => sum + Number(row.cost_usd_micros ?? 0), 0);
  }

  const { data: usage } = await admin
    .from("usage_events")
    .select("provider_cost_usd_micros")
    .eq("provider", provider)
    .gte("created_at", since);

  return (usage ?? []).reduce(
    (sum, row) => sum + Number(row.provider_cost_usd_micros ?? 0),
    0
  );
}

export async function isProviderUnderDailyCeiling(
  provider: string,
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): Promise<boolean> {
  const cfg = getProviderConfig(provider, snapshot);
  if (cfg.dailyCostCeilingUsdMicros == null) return true;
  const spent = await getProviderDailyCostUsdMicros(provider);
  return spent < cfg.dailyCostCeilingUsdMicros;
}

export { providerCostUsdMicros };
