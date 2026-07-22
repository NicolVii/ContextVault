/**
 * Explicit Cortaix commercial mode and unfinished-feature flags.
 *
 * Payments (Checkout / Customer Portal) require COMMERCIAL_MODE=live **and**
 * a configured Stripe secret. Demo and disabled modes must never create real
 * Stripe Checkout sessions — even if STRIPE_* env vars are present.
 *
 * Live mode additionally requires the live-readiness validator (prices,
 * webhook secret, app URL, live-key acknowledgement). Prefer
 * {@link assertLiveCommerceAllowed} on Checkout / Portal routes so webhook
 * health is checked before accepting money.
 */

import {
  assertLiveCommerceAllowed,
  assertLiveConfigAllowed,
  evaluateLiveConfigReadiness,
  type LiveCommerceGateResult,
  type LiveReadinessDenialCode,
} from "./live-readiness";

export type CommercialMode = "disabled" | "demo" | "live";

export type FeatureFlags = {
  /** Pro voice input / dictation product surface. */
  voice: boolean;
  /** Automatic credit-pack top-up when balance is low. */
  autoTopup: boolean;
  /** Enforce monthly pack spend cap in checkout / workers. */
  spendCapEnforcement: boolean;
  /** Apply workspace monthly credit budgets in metering. */
  workspaceBudgets: boolean;
  /** Enforce per-day Auto fair-use credit ceilings. */
  dailyFairUseCredits: boolean;
  /** Show optional Frontier boost pack on the storefront. */
  creditPackStorefront: boolean;
};

export type CommercialCapabilities = {
  mode: CommercialMode;
  /** Stripe secret key is present (does not imply payments are allowed). */
  stripeConfigured: boolean;
  /** Checkout sessions may be created (live + config ready). */
  checkoutEnabled: boolean;
  /** Customer Portal sessions may be created (live + config ready). */
  portalEnabled: boolean;
  /** Local/dev credit grant path. */
  devTopupAllowed: boolean;
  /** Founding Pro CTA may start Checkout. */
  foundingOfferCheckoutEnabled: boolean;
  /** Sync live-config readiness (webhook health checked at request time). */
  liveConfigReady: boolean;
  featureFlags: FeatureFlags;
};

export type CommercialGateDenial = {
  ok: false;
  status: 403 | 503;
  code: LiveReadinessDenialCode;
  error: string;
};

export type CommercialGateAllow = { ok: true };

export type CommercialGateResult = CommercialGateAllow | CommercialGateDenial;

const MODES = new Set<CommercialMode>(["disabled", "demo", "live"]);

/** Unfinished features — off by default; override with FEATURE_*=1|true|on. */
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  voice: false,
  autoTopup: false,
  spendCapEnforcement: false,
  workspaceBudgets: false,
  dailyFairUseCredits: false,
  creditPackStorefront: false,
};

const FEATURE_ENV_KEYS: Record<keyof FeatureFlags, string> = {
  voice: "FEATURE_VOICE",
  autoTopup: "FEATURE_AUTO_TOPUP",
  spendCapEnforcement: "FEATURE_SPEND_CAP_ENFORCEMENT",
  workspaceBudgets: "FEATURE_WORKSPACE_BUDGETS",
  dailyFairUseCredits: "FEATURE_DAILY_FAIR_USE",
  creditPackStorefront: "FEATURE_CREDIT_PACK_STOREFRONT",
};

function envFlagEnabled(env: NodeJS.ProcessEnv, key: string): boolean | null {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  return null;
}

/**
 * Resolve commercial mode from COMMERCIAL_MODE.
 * Unset defaults: demo outside production (local offline), disabled in production
 * so hosted deploys cannot take money without an explicit live switch.
 */
export function resolveCommercialMode(
  env: NodeJS.ProcessEnv = process.env
): CommercialMode {
  const raw = env.COMMERCIAL_MODE?.trim().toLowerCase();
  if (raw && MODES.has(raw as CommercialMode)) {
    return raw as CommercialMode;
  }
  if (env.NODE_ENV === "production") return "disabled";
  return "demo";
}

/** Pure Stripe secret presence — not a payment authorization. */
export function isStripeSecretConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim());
}

/**
 * Real Stripe Checkout / Portal are allowed only in live mode with a complete
 * live-config readiness report (secret, webhook secret, prices, app URL).
 * Demo mode never returns true, even when Stripe env vars exist.
 * Webhook health is enforced at request time via {@link assertLiveCommerceAllowed}.
 */
export function isStripePaymentsEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return evaluateLiveConfigReadiness(env).ready;
}

export function getFeatureFlags(
  env: NodeJS.ProcessEnv = process.env
): FeatureFlags {
  const flags = { ...DEFAULT_FEATURE_FLAGS };
  for (const key of Object.keys(FEATURE_ENV_KEYS) as (keyof FeatureFlags)[]) {
    const override = envFlagEnabled(env, FEATURE_ENV_KEYS[key]);
    if (override != null) flags[key] = override;
  }
  return flags;
}

/**
 * Dev top-up: non-production demo only. Never in live (use Stripe) or production.
 * Disabled commercial mode hides commercial actions, including top-up.
 */
export function isCommercialDevTopupAllowed(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.NODE_ENV === "production") return false;
  if (resolveCommercialMode(env) !== "demo") return false;
  return true;
}

export function getCommercialCapabilities(
  env: NodeJS.ProcessEnv = process.env
): CommercialCapabilities {
  const mode = resolveCommercialMode(env);
  const stripeConfigured = isStripeSecretConfigured(env);
  const liveConfig = evaluateLiveConfigReadiness(env);
  const paymentsEnabled = liveConfig.ready;
  return {
    mode,
    stripeConfigured,
    checkoutEnabled: paymentsEnabled,
    portalEnabled: paymentsEnabled,
    devTopupAllowed: isCommercialDevTopupAllowed(env),
    foundingOfferCheckoutEnabled: paymentsEnabled,
    liveConfigReady: liveConfig.ready,
    featureFlags: getFeatureFlags(env),
  };
}

function gateFromLiveResult(
  result: LiveCommerceGateResult
): CommercialGateResult {
  if (result.ok) return { ok: true };
  return {
    ok: false,
    status: result.status,
    code: result.code,
    error: result.error,
  };
}

/**
 * Sync config gate for Checkout. Prefer {@link assertCheckoutAllowedAsync}
 * on HTTP routes so webhook health is included.
 */
export function assertCheckoutAllowed(
  env: NodeJS.ProcessEnv = process.env
): CommercialGateResult {
  return gateFromLiveResult(assertLiveConfigAllowed(env));
}

/** Sync config gate for Customer Portal. Prefer the async variant on routes. */
export function assertPortalAllowed(
  env: NodeJS.ProcessEnv = process.env
): CommercialGateResult {
  return gateFromLiveResult(assertLiveConfigAllowed(env));
}

/** Full live-commerce gate including webhook health. */
export async function assertCheckoutAllowedAsync(
  env: NodeJS.ProcessEnv = process.env
): Promise<CommercialGateResult> {
  return gateFromLiveResult(await assertLiveCommerceAllowed(env));
}

/** Full portal gate including webhook health. */
export async function assertPortalAllowedAsync(
  env: NodeJS.ProcessEnv = process.env
): Promise<CommercialGateResult> {
  return gateFromLiveResult(await assertLiveCommerceAllowed(env));
}

export {
  evaluateLiveConfigReadiness,
  evaluateLiveReadiness,
  assertLiveCommerceAllowed,
  assertLiveConfigAllowed,
  isStripeTestSecret,
  isStripeLiveSecret,
  type LiveReadinessReport,
  type LiveReadinessCheck,
} from "./live-readiness";
