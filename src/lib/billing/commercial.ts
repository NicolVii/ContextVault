/**
 * Explicit Cortaix commercial mode and unfinished-feature flags.
 *
 * Payments (Checkout / Customer Portal) require COMMERCIAL_MODE=live **and**
 * a configured Stripe secret. Demo and disabled modes must never create real
 * Stripe Checkout sessions — even if STRIPE_* env vars are present.
 */

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
  /** Checkout sessions may be created. */
  checkoutEnabled: boolean;
  /** Customer Portal sessions may be created. */
  portalEnabled: boolean;
  /** Local/dev credit grant path. */
  devTopupAllowed: boolean;
  /** Founding Pro CTA may start Checkout. */
  foundingOfferCheckoutEnabled: boolean;
  featureFlags: FeatureFlags;
};

export type CommercialGateDenial = {
  ok: false;
  status: 403 | 503;
  code: "commercial_disabled" | "commercial_demo" | "stripe_not_configured";
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
 * Real Stripe Checkout / Portal are allowed only in live mode with keys.
 * Demo mode never returns true, even when Stripe env vars exist.
 */
export function isStripePaymentsEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    resolveCommercialMode(env) === "live" && isStripeSecretConfigured(env)
  );
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
  if (isStripePaymentsEnabled(env)) return false;
  return true;
}

export function getCommercialCapabilities(
  env: NodeJS.ProcessEnv = process.env
): CommercialCapabilities {
  const mode = resolveCommercialMode(env);
  const stripeConfigured = isStripeSecretConfigured(env);
  const paymentsEnabled = isStripePaymentsEnabled(env);
  return {
    mode,
    stripeConfigured,
    checkoutEnabled: paymentsEnabled,
    portalEnabled: paymentsEnabled,
    devTopupAllowed: isCommercialDevTopupAllowed(env),
    foundingOfferCheckoutEnabled: paymentsEnabled,
    featureFlags: getFeatureFlags(env),
  };
}

/** Shared gate for Checkout session creation. */
export function assertCheckoutAllowed(
  env: NodeJS.ProcessEnv = process.env
): CommercialGateResult {
  const mode = resolveCommercialMode(env);
  if (mode === "disabled") {
    return {
      ok: false,
      status: 403,
      code: "commercial_disabled",
      error: "Billing is disabled in this environment.",
    };
  }
  if (mode === "demo") {
    return {
      ok: false,
      status: 403,
      code: "commercial_demo",
      error: "Demo mode cannot create Stripe Checkout sessions.",
    };
  }
  if (!isStripeSecretConfigured(env)) {
    return {
      ok: false,
      status: 503,
      code: "stripe_not_configured",
      error: "Stripe is not configured. Set STRIPE_SECRET_KEY for live billing.",
    };
  }
  return { ok: true };
}

/** Shared gate for Customer Portal sessions. */
export function assertPortalAllowed(
  env: NodeJS.ProcessEnv = process.env
): CommercialGateResult {
  const mode = resolveCommercialMode(env);
  if (mode === "disabled") {
    return {
      ok: false,
      status: 403,
      code: "commercial_disabled",
      error: "Billing is disabled in this environment.",
    };
  }
  if (mode === "demo") {
    return {
      ok: false,
      status: 403,
      code: "commercial_demo",
      error: "Demo mode cannot open the Stripe billing portal.",
    };
  }
  if (!isStripeSecretConfigured(env)) {
    return {
      ok: false,
      status: 503,
      code: "stripe_not_configured",
      error: "Stripe is not configured.",
    };
  }
  return { ok: true };
}
