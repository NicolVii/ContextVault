/**
 * Live-mode commercial readiness.
 *
 * COMMERCIAL_MODE=live alone is not enough to accept money. Checkout and
 * Portal must also pass required Stripe configuration and webhook health.
 * Stripe test-mode secrets (sk_test_*) are the default path; live secrets
 * (sk_live_*) require an explicit STRIPE_ALLOW_LIVE_KEYS acknowledgement.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUBSCRIPTION_PLANS } from "./plan-defaults";

export type CommercialMode = "disabled" | "demo" | "live";

const MODES = new Set<CommercialMode>(["disabled", "demo", "live"]);

function resolveMode(env: NodeJS.ProcessEnv): CommercialMode {
  const raw = env.COMMERCIAL_MODE?.trim().toLowerCase();
  if (raw && MODES.has(raw as CommercialMode)) {
    return raw as CommercialMode;
  }
  if (env.NODE_ENV === "production") return "disabled";
  return "demo";
}

function secretConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim());
}

export type LiveReadinessCheckId =
  | "commercial_mode"
  | "stripe_secret"
  | "stripe_webhook_secret"
  | "stripe_price_lite_monthly"
  | "stripe_price_lite_annual"
  | "stripe_price_pro_monthly"
  | "stripe_price_pro_annual"
  | "app_url"
  | "live_keys_ack"
  | "webhook_health";

export type LiveReadinessCheck = {
  id: LiveReadinessCheckId;
  ok: boolean;
  blocking: boolean;
  detail: string;
};

export type LiveReadinessReport = {
  mode: CommercialMode;
  /** True only when mode is live and every blocking check passes. */
  ready: boolean;
  /** Stripe secret looks like test mode (sk_test_…). */
  stripeTestMode: boolean;
  /** Stripe secret looks like live mode (sk_live_…). */
  stripeLiveMode: boolean;
  checks: LiveReadinessCheck[];
  blockingReasons: string[];
};

export type LiveReadinessDenialCode =
  | "commercial_disabled"
  | "commercial_demo"
  | "stripe_not_configured"
  | "live_not_ready";

const REQUIRED_PRICE_ENVS: Array<{
  id: LiveReadinessCheckId;
  envKey: string;
  label: string;
}> = [
  {
    id: "stripe_price_lite_monthly",
    envKey: "STRIPE_PRICE_LITE_MONTHLY",
    label: "Lite monthly price",
  },
  {
    id: "stripe_price_lite_annual",
    envKey: "STRIPE_PRICE_LITE_ANNUAL",
    label: "Lite annual price",
  },
  {
    id: "stripe_price_pro_monthly",
    envKey: "STRIPE_PRICE_PRO_MONTHLY",
    label: "Pro monthly price",
  },
  {
    id: "stripe_price_pro_annual",
    envKey: "STRIPE_PRICE_PRO_ANNUAL",
    label: "Pro annual price",
  },
];

const WEBHOOK_STALE_HOURS = 72;
const WEBHOOK_FAILURE_WINDOW_HOURS = 24;

function envTruthy(env: NodeJS.ProcessEnv, key: string): boolean {
  const raw = env[key]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

export function isStripeTestSecret(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? "";
  return key.startsWith("sk_test_");
}

export function isStripeLiveSecret(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? "";
  return key.startsWith("sk_live_");
}

/** Required launch price env keys derived from the catalog defaults. */
export function requiredStripePriceEnvKeys(): string[] {
  const keys: string[] = [];
  for (const plan of SUBSCRIPTION_PLANS) {
    if (plan.id === "free") continue;
    if (plan.stripePriceEnvMonthly) keys.push(plan.stripePriceEnvMonthly);
    if (plan.stripePriceEnvAnnual) keys.push(plan.stripePriceEnvAnnual);
  }
  return keys;
}

/**
 * Synchronous configuration readiness (no DB). Use for unit tests and for
 * the first half of commerce gates; pair with webhook health for full ready.
 */
export function evaluateLiveConfigReadiness(
  env: NodeJS.ProcessEnv = process.env
): LiveReadinessReport {
  const mode = resolveMode(env);
  const checks: LiveReadinessCheck[] = [];
  const stripeTestMode = isStripeTestSecret(env);
  const stripeLiveMode = isStripeLiveSecret(env);

  checks.push({
    id: "commercial_mode",
    ok: mode === "live",
    blocking: true,
    detail:
      mode === "live"
        ? "COMMERCIAL_MODE=live"
        : `COMMERCIAL_MODE=${mode} (live required for payments)`,
  });

  const secretOk = secretConfigured(env);
  checks.push({
    id: "stripe_secret",
    ok: secretOk,
    blocking: true,
    detail: secretOk
      ? stripeTestMode
        ? "STRIPE_SECRET_KEY present (test mode)"
        : stripeLiveMode
          ? "STRIPE_SECRET_KEY present (live mode)"
          : "STRIPE_SECRET_KEY present"
      : "STRIPE_SECRET_KEY missing",
  });

  const webhookSecretOk = Boolean(env.STRIPE_WEBHOOK_SECRET?.trim());
  checks.push({
    id: "stripe_webhook_secret",
    ok: webhookSecretOk,
    blocking: true,
    detail: webhookSecretOk
      ? "STRIPE_WEBHOOK_SECRET present"
      : "STRIPE_WEBHOOK_SECRET missing",
  });

  for (const price of REQUIRED_PRICE_ENVS) {
    const ok = Boolean(env[price.envKey]?.trim());
    checks.push({
      id: price.id,
      ok,
      blocking: true,
      detail: ok
        ? `${price.envKey} configured`
        : `${price.envKey} missing (${price.label})`,
    });
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const appUrlOk = Boolean(appUrl) && /^https?:\/\//i.test(appUrl);
  checks.push({
    id: "app_url",
    ok: appUrlOk,
    blocking: true,
    detail: appUrlOk
      ? "NEXT_PUBLIC_APP_URL set"
      : "NEXT_PUBLIC_APP_URL missing or invalid (needed for Checkout return URLs)",
  });

  // Live Stripe credentials require explicit acknowledgement so test-mode
  // remains the default path until operators opt in.
  const liveKeysAck = !stripeLiveMode || envTruthy(env, "STRIPE_ALLOW_LIVE_KEYS");
  checks.push({
    id: "live_keys_ack",
    ok: liveKeysAck,
    blocking: true,
    detail: stripeLiveMode
      ? liveKeysAck
        ? "STRIPE_ALLOW_LIVE_KEYS acknowledged for sk_live_*"
        : "sk_live_* present but STRIPE_ALLOW_LIVE_KEYS is not set — use sk_test_* first"
      : "Using non-live Stripe secret (or unset)",
  });

  const blockingReasons = checks
    .filter((c) => c.blocking && !c.ok)
    .map((c) => c.detail);

  return {
    mode,
    ready: mode === "live" && blockingReasons.length === 0,
    stripeTestMode,
    stripeLiveMode,
    checks,
    blockingReasons,
  };
}

async function evaluateWebhookHealthCheck(): Promise<LiveReadinessCheck> {
  try {
    const admin = createSupabaseAdminClient();
    const sinceStale = new Date(
      Date.now() - WEBHOOK_STALE_HOURS * 60 * 60 * 1000
    ).toISOString();
    const sinceFail = new Date(
      Date.now() - WEBHOOK_FAILURE_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    const [
      { count: paidSubs },
      { count: recentWebhooks },
      { count: recentFailures },
      { data: lastWebhook },
    ] = await Promise.all([
      admin
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .not("stripe_subscription_id", "is", null)
        .in("status", ["active", "trialing", "past_due", "unpaid"]),
      admin
        .from("stripe_webhook_events")
        .select("*", { count: "exact", head: true })
        .gte("processed_at", sinceStale),
      admin
        .from("billing_telemetry_events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", "webhook_failed")
        .gte("created_at", sinceFail),
      admin
        .from("stripe_webhook_events")
        .select("event_id, event_type, processed_at")
        .order("processed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const paid = paidSubs ?? 0;
    const processed = recentWebhooks ?? 0;
    const failures = recentFailures ?? 0;
    const last = lastWebhook as
      | { event_id: string; event_type: string; processed_at: string }
      | null;

    // Cold start: no paid Stripe subscriptions yet — config alone is enough.
    if (paid === 0) {
      return {
        id: "webhook_health",
        ok: true,
        blocking: true,
        detail: last
          ? `No paid Stripe subscriptions yet; last webhook ${last.event_type} at ${last.processed_at}`
          : "No paid Stripe subscriptions yet — webhook health deferred until first paid sub",
      };
    }

    if (processed === 0) {
      return {
        id: "webhook_health",
        ok: false,
        blocking: true,
        detail: `Paid subscriptions exist but no webhooks processed in the last ${WEBHOOK_STALE_HOURS}h`,
      };
    }

    if (failures > 0 && failures >= processed) {
      return {
        id: "webhook_health",
        ok: false,
        blocking: true,
        detail: `${failures} webhook failure(s) in ${WEBHOOK_FAILURE_WINDOW_HOURS}h outweigh ${processed} processed event(s)`,
      };
    }

    return {
      id: "webhook_health",
      ok: true,
      blocking: true,
      detail: last
        ? `${processed} webhook(s) in ${WEBHOOK_STALE_HOURS}h; last ${last.event_type}`
        : `${processed} webhook(s) in ${WEBHOOK_STALE_HOURS}h`,
    };
  } catch (err) {
    return {
      id: "webhook_health",
      ok: false,
      blocking: true,
      detail: `Webhook health check failed: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    };
  }
}

/**
 * Full live readiness including DB-backed webhook health.
 * Non-live modes return ready=false with mode-appropriate blocking reasons.
 */
export async function evaluateLiveReadiness(
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveReadinessReport> {
  const base = evaluateLiveConfigReadiness(env);
  if (base.mode !== "live") {
    return base;
  }

  const webhook = await evaluateWebhookHealthCheck();
  const checks = [...base.checks, webhook];
  const blockingReasons = checks
    .filter((c) => c.blocking && !c.ok)
    .map((c) => c.detail);

  return {
    ...base,
    ready: blockingReasons.length === 0,
    checks,
    blockingReasons,
  };
}

export type LiveCommerceGateResult =
  | { ok: true; readiness: LiveReadinessReport }
  | {
      ok: false;
      status: 403 | 503;
      code: LiveReadinessDenialCode;
      error: string;
      readiness: LiveReadinessReport;
    };

/**
 * Gate Checkout / Portal for live commerce.
 * Demo/disabled never proceed. Live requires full readiness.
 */
export async function assertLiveCommerceAllowed(
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveCommerceGateResult> {
  const readiness = await evaluateLiveReadiness(env);

  if (readiness.mode === "disabled") {
    return {
      ok: false,
      status: 403,
      code: "commercial_disabled",
      error: "Billing is disabled in this environment.",
      readiness,
    };
  }
  if (readiness.mode === "demo") {
    return {
      ok: false,
      status: 403,
      code: "commercial_demo",
      error: "Demo mode cannot create Stripe Checkout or Portal sessions.",
      readiness,
    };
  }

  if (!secretConfigured(env)) {
    return {
      ok: false,
      status: 503,
      code: "stripe_not_configured",
      error: "Stripe is not configured. Set STRIPE_SECRET_KEY for live billing.",
      readiness,
    };
  }

  if (!readiness.ready) {
    return {
      ok: false,
      status: 503,
      code: "live_not_ready",
      error: `Live commerce is not ready: ${readiness.blockingReasons.join("; ")}`,
      readiness,
    };
  }

  return { ok: true, readiness };
}

/** Sync-only gate used when webhook health cannot be checked (rare). Prefer async. */
export function assertLiveConfigAllowed(
  env: NodeJS.ProcessEnv = process.env
): LiveCommerceGateResult {
  const readiness = evaluateLiveConfigReadiness(env);

  if (readiness.mode === "disabled") {
    return {
      ok: false,
      status: 403,
      code: "commercial_disabled",
      error: "Billing is disabled in this environment.",
      readiness,
    };
  }
  if (readiness.mode === "demo") {
    return {
      ok: false,
      status: 403,
      code: "commercial_demo",
      error: "Demo mode cannot create Stripe Checkout or Portal sessions.",
      readiness,
    };
  }
  if (!secretConfigured(env)) {
    return {
      ok: false,
      status: 503,
      code: "stripe_not_configured",
      error: "Stripe is not configured. Set STRIPE_SECRET_KEY for live billing.",
      readiness,
    };
  }
  if (!readiness.ready) {
    return {
      ok: false,
      status: 503,
      code: "live_not_ready",
      error: `Live commerce is not ready: ${readiness.blockingReasons.join("; ")}`,
      readiness,
    };
  }
  return { ok: true, readiness };
}
