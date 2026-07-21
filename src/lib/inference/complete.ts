import { getChatProvider } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai/provider";
import { resolveRoute } from "./router";
import { settleUsage } from "./meter";
import {
  assertCreditsAvailable,
  InsufficientCreditsError,
} from "./credits";
import { estimateCreditsForPreflight } from "./pricing";
import {
  estimateTokensFromMessages,
  mapOpenRouterUsage,
  type OpenRouterUsageBlob,
} from "./usage";
import type { InferenceRequest, InferenceResult, UsageDraft } from "./types";

export { InsufficientCreditsError };

/**
 * Inference Router — sole bridge from product code to provider adapters.
 * Resolves model selection, gates credits, calls ChatProvider, settles usage.
 */
export async function runInference(req: InferenceRequest): Promise<InferenceResult> {
  const started = Date.now();
  const route = resolveRoute(req.selection, req);

  const inputEstimate = Math.max(
    1,
    Math.ceil(
      req.input.messages.reduce((n, m) => n + m.content.length, 0) / 4
    )
  );

  // Pre-flight only when platform billing and a real provider will be used.
  // Mock completions are free (see settleUsage).
  const chat = getChatProvider();
  const willCharge = req.billingMode === "platform" && chat.name !== "mock";
  if (willCharge) {
    const hold = estimateCreditsForPreflight(route.modelId, inputEstimate);
    await assertCreditsAvailable(req.userId, hold);
  }

  const messages = req.input.messages as ChatMessage[];
  const completion = await chat.complete(route.providerModelId, messages, {
    temperature: req.constraints?.temperature,
    json: req.constraints?.json,
  });

  const providerName = completion.mocked ? "mock" : route.provider;
  const usageBase: Omit<UsageDraft, "measures" | "measuresSource"> = {
    requestId: req.requestId,
    tenantId: req.tenantId,
    userId: req.userId,
    purpose: req.purpose,
    modelId: route.modelId,
    provider: providerName,
    providerModelId: route.providerModelId,
    billingMode: req.billingMode,
  };

  let usage: UsageDraft;
  if (completion.usage) {
    usage = {
      ...usageBase,
      measures: completion.usage.measures,
      measuresSource: completion.usage.measuresSource,
    };
  } else if (completion.providerUsage) {
    usage = mapOpenRouterUsage(
      completion.providerUsage as OpenRouterUsageBlob,
      usageBase
    );
    if (usage.measuresSource === "estimated") {
      const est = estimateTokensFromMessages(messages, completion.content);
      usage = { ...usageBase, ...est };
    }
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
      providerModelId: route.providerModelId,
      reasonCode: route.reasonCode,
    },
    usage,
    meta: {
      latencyMs: Date.now() - started,
      mocked: completion.mocked,
    },
  };
}
