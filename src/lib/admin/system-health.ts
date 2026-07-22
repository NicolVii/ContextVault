/**
 * Cortaix system health report for /admin/system.
 * Aggregates env, providers, billing, storage, and failure signals.
 * Never returns secrets — only presence / status.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getChatProvider, readOpenRouterApiKey } from "@/lib/ai";
import { getEmbeddingProvider } from "@/lib/embeddings";
import { getMemoryProvider } from "@/lib/memory";
import { getExtractionProvider } from "@/lib/memory/extraction";
import { getCommercialCapabilities } from "@/lib/billing/commercial";
import {
  BYOK_KEY_DERIVATION_VERSION,
  resolveByokEncryptionSecret,
  MissingByokEncryptionKeyError,
} from "@/lib/billing/byok-crypto";
import {
  listOperationalControls,
  OPERATIONAL_CONTROL_META,
  type OperationalControlState,
} from "@/lib/admin/system-controls";
import { listAdapters } from "@/lib/inference/adapters";
import { ensureProviderOpsSnapshot, getProviderConfig } from "@/lib/inference/provider-ops";

export type HealthStatus = "ok" | "warn" | "error" | "unknown";

export interface HealthCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
  meta?: Record<string, unknown>;
}

export interface SystemHealthReport {
  generatedAt: string;
  commercialMode: string;
  environment: {
    nodeEnv: string | null;
    vercelEnv: string | null;
  };
  deploymentId: string | null;
  checks: HealthCheckItem[];
  failures: {
    failedJobs: number;
    failedInferenceRequests30d: number;
    failedWebhooks30d: number;
    criticalErrors30d: number;
  };
  featureFlags: Record<string, boolean>;
  controls: Array<
    OperationalControlState & {
      label: string;
      description: string;
      supportsTargets: boolean;
    }
  >;
}

function deploymentIdentifier(env: NodeJS.ProcessEnv = process.env): string | null {
  return (
    env.DEPLOYMENT_ID?.trim() ||
    env.VERCEL_DEPLOYMENT_ID?.trim() ||
    env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    env.GIT_COMMIT_SHA?.trim() ||
    null
  );
}

async function countSince(
  table: string,
  column: string,
  sinceIso: string,
  filters?: { eq?: Record<string, string>; in?: Record<string, string[]> }
): Promise<number> {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte(column, sinceIso);
  if (filters?.eq) {
    for (const [k, v] of Object.entries(filters.eq)) {
      q = q.eq(k, v);
    }
  }
  if (filters?.in) {
    for (const [k, vals] of Object.entries(filters.in)) {
      q = q.in(k, vals);
    }
  }
  const { count, error } = await q;
  if (error) {
    console.error(`system health count ${table} failed`, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getSystemHealthReport(): Promise<SystemHealthReport> {
  const commercial = getCommercialCapabilities();
  const chat = getChatProvider();
  const embeddings = getEmbeddingProvider();
  const memory = getMemoryProvider();
  const extraction = getExtractionProvider();
  const openRouterKey = readOpenRouterApiKey();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const admin = createSupabaseAdminClient();

  const [
    storageBuckets,
    webhookRecent,
    webhookLast,
    failedDocs,
    failedInference,
    webhookFailures,
    criticalTelemetry,
    controls,
    providerSnap,
  ] = await Promise.all([
    admin.storage
      .listBuckets()
      .then((r) => r)
      .catch(() => ({ data: null, error: { message: "unavailable" } })),
    countSince("stripe_webhook_events", "processed_at", since24h),
    admin
      .from("stripe_webhook_events")
      .select("event_id, event_type, processed_at")
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    countSince("documents", "created_at", since30d, {
      eq: { status: "failed" },
    }),
    countSince("provider_ops_events", "created_at", since30d, {
      eq: { outcome: "failure" },
    }),
    countSince("billing_telemetry_events", "created_at", since30d, {
      eq: { event_name: "webhook_failed" },
    }),
    countSince("billing_telemetry_events", "created_at", since30d, {
      in: {
        event_name: [
          "payment_failed",
          "inference_restricted",
          "webhook_failed",
        ],
      },
    }),
    listOperationalControls(),
    ensureProviderOpsSnapshot(),
  ]);

  const checks: HealthCheckItem[] = [];

  checks.push({
    id: "commercial_mode",
    label: "Commercial mode",
    status:
      commercial.mode === "live"
        ? commercial.checkoutEnabled
          ? "ok"
          : "warn"
        : commercial.mode === "demo"
          ? "ok"
          : "warn",
    detail: commercial.mode,
    meta: {
      checkoutEnabled: commercial.checkoutEnabled,
      portalEnabled: commercial.portalEnabled,
      stripeConfigured: commercial.stripeConfigured,
    },
  });

  const nodeEnv = process.env.NODE_ENV ?? null;
  const vercelEnv = process.env.VERCEL_ENV ?? null;
  checks.push({
    id: "environment",
    label: "Environment",
    status: "ok",
    detail: [nodeEnv, vercelEnv].filter(Boolean).join(" / ") || "unknown",
    meta: { nodeEnv, vercelEnv },
  });

  const deploymentId = deploymentIdentifier();
  checks.push({
    id: "deployment",
    label: "Deployment identifier",
    status: deploymentId ? "ok" : "warn",
    detail: deploymentId ?? "Not set (DEPLOYMENT_ID / VERCEL_DEPLOYMENT_ID)",
  });

  const supabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const supabaseAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  const supabaseService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  checks.push({
    id: "supabase",
    label: "Supabase",
    status: supabaseUrl && supabaseAnon && supabaseService ? "ok" : "error",
    detail:
      supabaseUrl && supabaseAnon && supabaseService
        ? "URL + anon + service role configured"
        : "Missing Supabase env configuration",
    meta: {
      urlConfigured: supabaseUrl,
      anonConfigured: supabaseAnon,
      serviceRoleConfigured: supabaseService,
    },
  });

  // Migrations: prefer supabase_migrations.schema_migrations; fall back quietly.
  let latestVersion: string | null = null;
  let recentVersions: string[] = [];
  let migError: string | null = null;
  try {
    const { data, error } = await admin
      .schema("supabase_migrations")
      .from("schema_migrations")
      .select("version")
      .order("version", { ascending: false })
      .limit(5);
    if (error) {
      migError = error.message;
    } else {
      recentVersions = (data ?? []).map((r) => String((r as { version: string }).version));
      latestVersion = recentVersions[0] ?? null;
    }
  } catch (err) {
    migError = err instanceof Error ? err.message : "unavailable";
  }
  checks.push({
    id: "migrations",
    label: "Database migrations",
    status: migError ? "warn" : latestVersion ? "ok" : "unknown",
    detail: migError
      ? `Could not read schema_migrations (${migError})`
      : latestVersion
        ? `Latest applied: ${latestVersion}`
        : "No migration rows found",
    meta: {
      latest: latestVersion,
      recent: recentVersions,
    },
  });

  const buckets =
    storageBuckets && "data" in storageBuckets ? storageBuckets.data : null;
  const bucketError =
    storageBuckets && "error" in storageBuckets ? storageBuckets.error : null;
  const hasDocsBucket = Array.isArray(buckets)
    ? buckets.some((b) => b.name === "documents" || b.id === "documents")
    : false;
  checks.push({
    id: "storage",
    label: "Storage",
    status: bucketError ? "warn" : hasDocsBucket ? "ok" : "warn",
    detail: bucketError
      ? `Storage list failed: ${bucketError.message}`
      : hasDocsBucket
        ? "documents bucket present"
        : "documents bucket not found",
    meta: {
      buckets: Array.isArray(buckets) ? buckets.map((b) => b.name) : [],
    },
  });

  const providerStatuses = listAdapters().map((id) => {
    const cfg = getProviderConfig(id, providerSnap);
    const configured =
      id === "mock"
        ? true
        : id === "openrouter"
          ? Boolean(openRouterKey)
          : id === "openai"
            ? Boolean(process.env.OPENAI_API_KEY?.trim())
            : id === "anthropic"
              ? Boolean(process.env.ANTHROPIC_API_KEY?.trim())
              : id === "google"
                ? Boolean(
                    process.env.GOOGLE_API_KEY?.trim() ||
                      process.env.GEMINI_API_KEY?.trim()
                  )
                : id === "groq"
                  ? Boolean(process.env.GROQ_API_KEY?.trim())
                  : false;
    return {
      id,
      enabled: cfg.enabled,
      mockOnly: cfg.mockOnly,
      configured,
    };
  });
  const liveConfigured = providerStatuses.filter(
    (p) => p.id !== "mock" && p.configured
  ).length;
  checks.push({
    id: "ai_providers",
    label: "AI providers",
    status:
      chat.name === "mock" && liveConfigured === 0
        ? "warn"
        : "ok",
    detail: `Chat=${chat.name}; ${liveConfigured} live key(s) configured`,
    meta: {
      chatProvider: chat.name,
      extractionProvider: extraction.name,
      providers: providerStatuses,
      openRouterKeyConfigured: Boolean(openRouterKey),
    },
  });

  checks.push({
    id: "embeddings",
    label: "Embeddings",
    status: "ok",
    detail: embeddings.name,
    meta: {
      provider: embeddings.name,
      env: process.env.EMBEDDING_PROVIDER ?? "local",
    },
  });

  checks.push({
    id: "memory",
    label: "Memory backend",
    status: "ok",
    detail: memory.name,
    meta: {
      provider: memory.name,
      env: process.env.MEMORY_PROVIDER ?? "supabase",
    },
  });

  checks.push({
    id: "stripe",
    label: "Stripe configuration",
    status: commercial.stripeConfigured
      ? commercial.mode === "live"
        ? "ok"
        : "warn"
      : commercial.mode === "live"
        ? "error"
        : "ok",
    detail: commercial.stripeConfigured
      ? `Secret present · mode=${commercial.mode}`
      : `Secret missing · mode=${commercial.mode}`,
    meta: {
      secretConfigured: commercial.stripeConfigured,
      webhookSecretConfigured: Boolean(
        process.env.STRIPE_WEBHOOK_SECRET?.trim()
      ),
      checkoutEnabled: commercial.checkoutEnabled,
    },
  });

  const lastWebhook = webhookLast.data as
    | { event_id: string; event_type: string; processed_at: string }
    | null;
  checks.push({
    id: "webhooks",
    label: "Webhook health",
    status:
      !commercial.stripeConfigured
        ? "ok"
        : webhookRecent > 0 || lastWebhook
          ? "ok"
          : "warn",
    detail: lastWebhook
      ? `${webhookRecent} processed (24h); last ${lastWebhook.event_type} at ${lastWebhook.processed_at}`
      : commercial.stripeConfigured
        ? "No processed webhooks yet"
        : "Stripe not configured — webhooks idle",
    meta: {
      processed24h: webhookRecent,
      last: lastWebhook,
      failed30d: webhookFailures,
    },
  });

  let byokStatus: HealthStatus = "ok";
  let byokDetail = "Encryption key available";
  try {
    resolveByokEncryptionSecret();
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.BYOK_ENCRYPTION_KEY?.trim()
    ) {
      byokStatus = "error";
      byokDetail = "Production requires dedicated BYOK_ENCRYPTION_KEY";
    } else if (!process.env.BYOK_ENCRYPTION_KEY?.trim()) {
      byokStatus = "warn";
      byokDetail = "Using local fallback secret (service role)";
    }
  } catch (err) {
    byokStatus = "error";
    byokDetail =
      err instanceof MissingByokEncryptionKeyError
        ? err.message
        : "BYOK encryption unavailable";
  }
  checks.push({
    id: "byok",
    label: "BYOK encryption",
    status: byokStatus,
    detail: byokDetail,
    meta: { derivationVersion: BYOK_KEY_DERIVATION_VERSION },
  });

  checks.push({
    id: "failed_jobs",
    label: "Failed jobs",
    status: failedDocs > 0 ? "warn" : "ok",
    detail: `${failedDocs} failed document job(s) (30d)`,
    meta: { documentsFailed30d: failedDocs },
  });

  checks.push({
    id: "failed_inference",
    label: "Failed inference requests",
    status: failedInference > 50 ? "error" : failedInference > 0 ? "warn" : "ok",
    detail: `${failedInference} provider failure event(s) (30d)`,
  });

  checks.push({
    id: "failed_webhooks",
    label: "Failed webhooks",
    status: webhookFailures > 0 ? "warn" : "ok",
    detail: `${webhookFailures} webhook_failed telemetry event(s) (30d)`,
  });

  checks.push({
    id: "critical_errors",
    label: "Critical errors",
    status:
      criticalTelemetry > 20 ? "error" : criticalTelemetry > 0 ? "warn" : "ok",
    detail: `${criticalTelemetry} critical billing/ops event(s) (30d)`,
    meta: {
      includes: ["payment_failed", "inference_restricted", "webhook_failed"],
    },
  });

  checks.push({
    id: "feature_flags",
    label: "Feature flags",
    status: "ok",
    detail: Object.entries(commercial.featureFlags)
      .map(([k, v]) => `${k}=${v ? "on" : "off"}`)
      .join(", "),
    meta: { ...commercial.featureFlags },
  });

  return {
    generatedAt: new Date().toISOString(),
    commercialMode: commercial.mode,
    environment: { nodeEnv, vercelEnv },
    deploymentId,
    checks,
    failures: {
      failedJobs: failedDocs,
      failedInferenceRequests30d: failedInference,
      failedWebhooks30d: webhookFailures,
      criticalErrors30d: criticalTelemetry,
    },
    featureFlags: { ...commercial.featureFlags },
    controls: controls.map((c) => ({
      ...c,
      label: OPERATIONAL_CONTROL_META[c.key].label,
      description: OPERATIONAL_CONTROL_META[c.key].description,
      supportsTargets: OPERATIONAL_CONTROL_META[c.key].supportsTargets,
    })),
  };
}
