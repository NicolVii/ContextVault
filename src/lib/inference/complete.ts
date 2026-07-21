import { readOpenRouterApiKey } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai/provider";
import { loadUserProviderKey } from "@/lib/billing/byok";
import { getAdapter } from "./adapters";
import { resolveRoute } from "./router";
import { settleUsage } from "./meter";
import {
  assertCreditsAvailable,
  InsufficientCreditsError,
} from "./credits";
import { estimateCreditsForPreflight } from "./pricing";
import { estimateTokensFromMessages } from "./usage";
import { resolveModelProfile, type ProviderBinding } from "./models";
import type { InferenceRequest, InferenceResult, UsageDraft } from "./types";

export { InsufficientCreditsError };

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
  billingMode: "platform" | "byok"
): Promise<{ key: string; source: "platform" | "byok" } | null> {
  if (billingMode === "byok") {
    const byok = await loadUserProviderKey(userId, provider);
    return byok ? { key: byok, source: "byok" } : null;
  }

  const platform = platformKeysFor(provider);
  if (platform.length > 0) {
    const idx = Math.floor(Date.now() / 60_000) % platform.length;
    return { key: platform[idx] ?? platform[0]!, source: "platform" };
  }

  // Fall back to the user's own key when platform has none for this provider.
  const byok = await loadUserProviderKey(userId, provider);
  return byok ? { key: byok, source: "byok" } : null;
}

function orderedBindings(
  routeBinding: ProviderBinding,
  profileBindings: ProviderBinding[]
): ProviderBinding[] {
  const rest = profileBindings.filter(
    (b) =>
      !(b.provider === routeBinding.provider && b.providerModelId === routeBinding.providerModelId)
  );
  return [routeBinding, ...rest];
}

/**
 * Inference Router — sole bridge from product code to provider adapters.
 * Resolves model selection, gates credits, calls adapters with failover, settles usage.
 */
export async function runInference(req: InferenceRequest): Promise<InferenceResult> {
  const started = Date.now();
  const route = resolveRoute(req.selection, req);
  const profile = resolveModelProfile(route.modelId);
  const bindings = orderedBindings(
    { provider: route.provider, providerModelId: route.providerModelId },
    profile?.bindings ?? []
  );

  const inputEstimate = Math.max(
    1,
    Math.ceil(req.input.messages.reduce((n, m) => n + m.content.length, 0) / 4)
  );

  let hasRunnable = false;
  for (const b of bindings) {
    if (await resolveApiKey(req.userId, b.provider, req.billingMode)) {
      hasRunnable = true;
      break;
    }
  }
  const useMock = !hasRunnable;

  const willCharge = req.billingMode === "platform" && !useMock;
  if (willCharge) {
    const hold = estimateCreditsForPreflight(route.modelId, inputEstimate);
    await assertCreditsAvailable(req.userId, hold);
  }

  const messages = req.input.messages as ChatMessage[];

  let completion: Awaited<ReturnType<NonNullable<ReturnType<typeof getAdapter>>["complete"]>> | null =
    null;
  let usedProvider = route.provider;
  let usedProviderModelId = route.providerModelId;
  let effectiveBillingMode = req.billingMode;
  const errors: string[] = [];

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
  } else {
    for (const binding of bindings) {
      const adapter = getAdapter(binding.provider);
      if (!adapter) continue;
      const resolved = await resolveApiKey(req.userId, binding.provider, req.billingMode);
      if (!resolved) {
        errors.push(`${binding.provider}: no api key`);
        continue;
      }
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
        if (resolved.source === "byok") effectiveBillingMode = "byok";
        break;
      } catch (err) {
        errors.push(
          `${binding.provider}: ${err instanceof Error ? err.message : "failed"}`
        );
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

  await settleUsage(usage);

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
      latencyMs: Date.now() - started,
      mocked: completion.mocked,
    },
  };
}
