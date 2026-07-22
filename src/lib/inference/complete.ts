import { readOpenRouterApiKey } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai/provider";
import { loadUserProviderKey } from "@/lib/billing/byok";
import {
  assertPlanAllowsTurn,
  classifyUsageIntensity,
  getPlanUsageSnapshot,
  PlanUsageBlockedError,
  recordPlanTurn,
} from "@/lib/billing";
import { getAdapter } from "./adapters";
import { resolveRoute } from "./router";
import { settleUsage, computeCreditsCharged } from "./meter";
import {
  assertCreditsAvailable,
  InsufficientCreditsError,
} from "./credits";
import { estimateCreditsForPreflight } from "./pricing";
import { estimateTokensFromMessages } from "./usage";
import { resolveModelProfile, type ProviderBinding } from "./models";
import {
  ensureProviderOpsSnapshot,
  filterAndOrderBindings,
  getProviderConfig,
  isProviderUnderDailyCeiling,
  recordProviderOpsEvent,
  type ProviderOpsSnapshot,
} from "./provider-ops";
import {
  ensureOperationalControlsSnapshot,
  getControl,
  isControlActive,
  isModelShutDown,
  isProviderShutDown,
  OperationalControlError,
  type OperationalControlsSnapshot,
} from "@/lib/admin/system-controls";
import { providerCostUsdMicros } from "./pricing";
import type { InferenceRequest, InferenceResult, UsageDraft } from "./types";

export { InsufficientCreditsError, PlanUsageBlockedError, OperationalControlError };

function platformKeysFor(provider: string): string[] {
  if (provider === "openrouter") {
    const pool = process.env.OPENROUTER_API_KEYS?.split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (pool && pool.length > 0) return pool;
    const single = readOpenRouterApiKey();
    return single ? [single] : [];
  }
  if (provider === "openai") {
    const k = process.env.OPENAI_API_KEY?.trim();
    return k ? [k] : [];
  }
  if (provider === "anthropic") {
    const k = process.env.ANTHROPIC_API_KEY?.trim();
    return k ? [k] : [];
  }
  if (provider === "google") {
    const k = process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
    return k ? [k] : [];
  }
  if (provider === "groq") {
    const k = process.env.GROQ_API_KEY?.trim();
    return k ? [k] : [];
  }
  return [];
}

async function resolveApiKey(
  userId: string,
  provider: string,
  billingMode: "platform" | "byok",
  allowByokFallback: boolean,
  snapshot: ProviderOpsSnapshot
): Promise<{ key: string; source: "platform" | "byok" } | null> {
  const cfg = getProviderConfig(provider, snapshot);
  if (!cfg.enabled || cfg.mockOnly) return null;

  if (billingMode === "byok") {
    if (!allowByokFallback || !cfg.allowByok) return null;
    const byok = await loadUserProviderKey(userId, provider);
    return byok ? { key: byok, source: "byok" } : null;
  }

  if (cfg.allowPlatform) {
    const platform = platformKeysFor(provider);
    if (platform.length > 0) {
      const idx = Math.floor(Date.now() / 60_000) % platform.length;
      return { key: platform[idx] ?? platform[0]!, source: "platform" };
    }
  }

  if (!allowByokFallback || !cfg.allowByok) return null;
  const byok = await loadUserProviderKey(userId, provider);
  return byok ? { key: byok, source: "byok" } : null;
}

function orderedBindings(
  routeBinding: ProviderBinding,
  profileBindings: ProviderBinding[],
  snapshot: ProviderOpsSnapshot,
  controls: OperationalControlsSnapshot
): ProviderBinding[] {
  const preferred = filterAndOrderBindings(
    [routeBinding, ...profileBindings],
    snapshot
  ).filter((b) => !isProviderShutDown(b.provider, controls));
  // Dedupe while keeping ops priority order; ensure route binding wins ties.
  const seen = new Set<string>();
  const out: ProviderBinding[] = [];
  const routeKey = `${routeBinding.provider}:${routeBinding.providerModelId}`;
  const filtered = preferred.filter((b) => {
    const key = `${b.provider}:${b.providerModelId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Prefer the routed binding first when it survived filtering.
  const routeFirst = filtered.find(
    (b) => `${b.provider}:${b.providerModelId}` === routeKey
  );
  if (routeFirst) {
    out.push(routeFirst);
    for (const b of filtered) {
      if (`${b.provider}:${b.providerModelId}` !== routeKey) out.push(b);
    }
    return out;
  }
  return filtered;
}

/**
 * Inference Router — sole bridge from product code to provider adapters.
 * Resolves model selection, gates credits, calls adapters with failover, settles usage.
 * Honors provider/model ops status (enabled, mock-only, daily ceiling, eligibility).
 */
export async function runInference(req: InferenceRequest): Promise<InferenceResult> {
  const started = Date.now();
  const snapshot = await ensureProviderOpsSnapshot();
  const controls = await ensureOperationalControlsSnapshot();

  if (isControlActive("maintenance_mode", controls)) {
    const reason = getControl("maintenance_mode", controls).reason;
    throw new OperationalControlError(
      "maintenance_mode",
      reason?.trim() ||
        "The platform is in maintenance mode. Please try again later.",
      503
    );
  }

  const snap = await getPlanUsageSnapshot(req.userId);
  const gatedReq: InferenceRequest = {
    ...req,
    cheapOnlyRouting: req.cheapOnlyRouting ?? snap.planId === "free",
    // BYOK is a Pro entitlement; force platform billing otherwise.
    billingMode:
      req.billingMode === "byok" && !snap.entitlements.byok ? "platform" : req.billingMode,
  };

  const route = resolveRoute(gatedReq.selection, gatedReq, snapshot);
  if (isModelShutDown(route.modelId, controls)) {
    throw new OperationalControlError(
      "model_shutdown",
      "This model is temporarily unavailable.",
      503
    );
  }

  const intensity = classifyUsageIntensity(gatedReq.selection, route.modelId);
  if (intensity === "frontier" && isControlActive("frontier_shutdown", controls)) {
    throw new OperationalControlError(
      "frontier_shutdown",
      "Frontier models are temporarily unavailable.",
      503
    );
  }

  const profile = resolveModelProfile(route.modelId);
  const bindings = orderedBindings(
    { provider: route.provider, providerModelId: route.providerModelId },
    profile?.bindings ?? [],
    snapshot,
    controls
  );

  if (
    isControlActive("provider_shutdown", controls) &&
    getControl("provider_shutdown", controls).targetIds.length === 0
  ) {
    throw new OperationalControlError(
      "provider_shutdown",
      "Inference providers are temporarily unavailable.",
      503
    );
  }

  const inputEstimate = Math.max(
    1,
    Math.ceil(req.input.messages.reduce((n, m) => n + m.content.length, 0) / 4)
  );
  const hold = estimateCreditsForPreflight(route.modelId, inputEstimate);

  const forceMock = isControlActive("mock_only_mode", controls);

  let hasRunnable = false;
  if (!forceMock) {
    for (const b of bindings) {
      if (isProviderShutDown(b.provider, controls)) continue;
      const underCeiling = await isProviderUnderDailyCeiling(b.provider, snapshot);
      if (!underCeiling) continue;
      if (
        await resolveApiKey(
          req.userId,
          b.provider,
          gatedReq.billingMode,
          snap.entitlements.byok,
          snapshot
        )
      ) {
        hasRunnable = true;
        break;
      }
    }
  }
  const useMock = forceMock || !hasRunnable;

  const willCharge = gatedReq.billingMode === "platform" && !useMock;
  if (willCharge) {
    await assertPlanAllowsTurn({
      userId: req.userId,
      intensity,
      estimatedCredits: hold,
    });
    await assertCreditsAvailable(req.userId, hold);
  }

  const messages = req.input.messages as ChatMessage[];

  let completion: Awaited<ReturnType<NonNullable<ReturnType<typeof getAdapter>>["complete"]>> | null =
    null;
  let usedProvider = route.provider;
  let usedProviderModelId = route.providerModelId;
  let effectiveBillingMode = gatedReq.billingMode;
  const errors: string[] = [];
  let failoverCount = 0;
  let attempts = 0;

  if (useMock) {
    const adapter = getAdapter("mock")!;
    completion = await adapter.complete({
      model: route.providerModelId,
      messages,
      apiKey: "mock",
      temperature: req.constraints?.temperature,
      json: req.constraints?.json,
    });
    usedProvider = "mock";
    await recordProviderOpsEvent({
      requestId: req.requestId,
      provider: "mock",
      modelId: route.modelId,
      providerModelId: route.providerModelId,
      outcome: "mock_fallback",
      latencyMs: Date.now() - started,
      costUsdMicros: 0,
    });
  } else {
    for (const binding of bindings) {
      const underCeiling = await isProviderUnderDailyCeiling(
        binding.provider,
        snapshot
      );
      if (!underCeiling) {
        errors.push(`${binding.provider}: daily cost ceiling reached`);
        continue;
      }

      const adapter = getAdapter(binding.provider);
      if (!adapter) continue;
      const resolved = await resolveApiKey(
        req.userId,
        binding.provider,
        gatedReq.billingMode,
        snap.entitlements.byok,
        snapshot
      );
      if (!resolved) {
        errors.push(`${binding.provider}: no api key`);
        continue;
      }

      attempts += 1;
      if (attempts > 1) {
        failoverCount += 1;
        await recordProviderOpsEvent({
          requestId: req.requestId,
          provider: binding.provider,
          modelId: route.modelId,
          providerModelId: binding.providerModelId,
          outcome: "failover",
        });
      }

      const attemptStarted = Date.now();
      try {
        completion = await adapter.complete({
          model: binding.providerModelId,
          messages,
          apiKey: resolved.key,
          temperature: req.constraints?.temperature,
          json: req.constraints?.json,
        });
        usedProvider = binding.provider;
        usedProviderModelId = binding.providerModelId;
        // Only honor BYOK debit skip when the plan allows BYOK.
        if (resolved.source === "byok" && snap.entitlements.byok) {
          effectiveBillingMode = "byok";
        }

        const estUsage =
          completion.usage?.measures ??
          estimateTokensFromMessages(messages, completion.content).measures;
        const inputTokens = estUsage.inputTokens ?? 0;
        const outputTokens = estUsage.outputTokens ?? 0;
        const cost =
          effectiveBillingMode === "byok"
            ? 0
            : providerCostUsdMicros(route.modelId, inputTokens, outputTokens);

        await recordProviderOpsEvent({
          requestId: req.requestId,
          provider: binding.provider,
          modelId: route.modelId,
          providerModelId: binding.providerModelId,
          outcome: "success",
          latencyMs: Date.now() - attemptStarted,
          costUsdMicros: cost,
        });
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : "failed";
        errors.push(`${binding.provider}: ${message}`);
        await recordProviderOpsEvent({
          requestId: req.requestId,
          provider: binding.provider,
          modelId: route.modelId,
          providerModelId: binding.providerModelId,
          outcome: "failure",
          latencyMs: Date.now() - attemptStarted,
          errorClass: "unknown",
        });
      }
    }
  }

  if (!completion) {
    throw new Error(
      errors.length > 0
        ? `All providers failed: ${errors.join(" | ")}`
        : "No provider available for this model"
    );
  }

  const providerName = completion.mocked ? "mock" : usedProvider;
  const latencyMs = Date.now() - started;
  const usageBase: Omit<UsageDraft, "measures" | "measuresSource"> = {
    requestId: req.requestId,
    tenantId: req.tenantId,
    userId: req.userId,
    purpose: req.purpose,
    modelId: route.modelId,
    provider: providerName,
    providerModelId: usedProviderModelId,
    billingMode: effectiveBillingMode,
  };

  let usage: UsageDraft;
  if (completion.usage) {
    usage = {
      ...usageBase,
      measures: completion.usage.measures,
      measuresSource: completion.usage.measuresSource,
    };
  } else {
    const est = estimateTokensFromMessages(messages, completion.content);
    usage = { ...usageBase, ...est };
  }

  const settlement = await settleUsage(usage, {
    latencyMs,
    failoverCount,
  });
  const charged =
    settlement.creditsCharged ||
    computeCreditsCharged(usage);

  if (effectiveBillingMode === "platform" && !useMock) {
    await recordPlanTurn({
      userId: req.userId,
      planId: snap.planId,
      intensity,
      credits: charged,
      modelId: route.modelId,
    });
  }

  return {
    requestId: req.requestId,
    output: { message: completion.content },
    resolved: {
      modelId: route.modelId,
      provider: providerName,
      providerModelId: usedProviderModelId,
      reasonCode: route.reasonCode,
    },
    usage,
    meta: {
      latencyMs,
      mocked: completion.mocked,
    },
  };
}
