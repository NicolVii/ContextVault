import {
  DEFAULT_MODEL_ID,
  defaultBinding,
  presetReasonCode,
  resolveModelProfile,
  type ModelProfile,
} from "./models";
import {
  ensureProviderOpsSnapshot,
  filterAndOrderBindings,
  getModelOverride,
  getProviderOpsSync,
  getRoutableModels,
  isModelAutoEligible,
  isModelEnabledForRouting,
  type ProviderOpsSnapshot,
} from "./provider-ops";
import type {
  InferenceRequest,
  ModelPreset,
  RouteReasonCode,
  SelectionPolicy,
} from "./types";

const LONG_CONTEXT_CHAR_THRESHOLD = 24_000;

const CODING_HINT =
  /\b(code|coding|typescript|javascript|python|bug|debug|refactor|function|class|api|sql|compile|stack.?trace|pull request|pr\b|github)\b/i;

export interface RouteDecision {
  modelId: string;
  provider: string;
  providerModelId: string;
  reasonCode: RouteReasonCode;
  profile: ModelProfile;
}

function activeModels(snapshot: ProviderOpsSnapshot): ModelProfile[] {
  return getRoutableModels(snapshot);
}

function bestBy(
  snapshot: ProviderOpsSnapshot,
  score: (m: ModelProfile) => number,
  predicate: (m: ModelProfile) => boolean = () => true
): ModelProfile {
  const candidates = activeModels(snapshot).filter(predicate);
  if (candidates.length === 0) {
    const fallback = resolveModelProfile(DEFAULT_MODEL_ID);
    if (!fallback) throw new Error("Default model missing from catalog");
    return fallback;
  }
  return candidates.reduce((best, cur) => (score(cur) > score(best) ? cur : best));
}

function pickForPreset(
  snapshot: ProviderOpsSnapshot,
  preset: ModelPreset
): ModelProfile {
  switch (preset) {
    case "fast":
      return bestBy(snapshot, (m) => m.suitability.fast);
    case "smart":
      return bestBy(
        snapshot,
        (m) => m.suitability.chat * 0.6 + m.suitability.coding * 0.4
      );
    case "coding":
      return bestBy(snapshot, (m) => m.suitability.coding);
    case "vision":
      return bestBy(
        snapshot,
        (m) => m.suitability.vision,
        (m) => m.capabilities.vision
      );
    case "long-context":
      return bestBy(snapshot, (m) => m.suitability.longContext);
    case "cheap":
      return bestBy(snapshot, (m) => m.suitability.cheap);
  }
}

const AUTO_CHEAP_MIN = 0.7;

function pickAuto(
  snapshot: ProviderOpsSnapshot,
  req: InferenceRequest
): { profile: ModelProfile; reason: RouteReasonCode } {
  const cheapOnly = Boolean(req.cheapOnlyRouting);
  const autoGate = (m: ModelProfile) => {
    if (!isModelAutoEligible(m.id, snapshot)) return false;
    if (cheapOnly && m.suitability.cheap < AUTO_CHEAP_MIN) return false;
    return true;
  };

  if (req.input.hasVisionAttachment) {
    return {
      profile: bestBy(
        snapshot,
        (m) => m.suitability.vision,
        (m) => m.capabilities.vision && autoGate(m)
      ),
      reason: "vision_required",
    };
  }

  const contextChars = req.input.contextChars ?? 0;
  if (contextChars >= LONG_CONTEXT_CHAR_THRESHOLD && !cheapOnly) {
    return {
      profile: bestBy(
        snapshot,
        (m) => m.suitability.longContext,
        autoGate
      ),
      reason: "long_context_required",
    };
  }

  const lastUser = [...req.input.messages].reverse().find((m) => m.role === "user");
  if (lastUser && CODING_HINT.test(lastUser.content) && !cheapOnly) {
    return {
      profile: bestBy(snapshot, (m) => m.suitability.coding, autoGate),
      reason: "coding_heuristic",
    };
  }

  return {
    profile: bestBy(
      snapshot,
      (m) => m.suitability.cheap * 0.6 + m.suitability.fast * 0.4,
      autoGate
    ),
    reason: "cost_optimized",
  };
}

function pickBinding(
  profile: ModelProfile,
  snapshot: ProviderOpsSnapshot
): { provider: string; providerModelId: string } {
  const ordered = filterAndOrderBindings(profile.bindings, snapshot);
  if (ordered.length > 0) {
    return ordered[0]!;
  }
  // Fall back to catalog default when all providers are ops-disabled;
  // complete.ts will still mock if nothing is runnable.
  return defaultBinding(profile);
}

/**
 * Deterministic, explainable model selection.
 * Honor explicit model → preset → auto signals. No LLM-in-the-loop.
 * Respects DB-backed provider/model enablement and Auto eligibility.
 */
export function resolveRoute(
  selection: SelectionPolicy,
  req: Pick<InferenceRequest, "input" | "purpose" | "cheapOnlyRouting">,
  snapshot: ProviderOpsSnapshot = getProviderOpsSync()
): RouteDecision {
  if (selection.type === "model") {
    const profile = resolveModelProfile(selection.modelId);
    if (!profile || !isModelEnabledForRouting(profile.id, snapshot)) {
      throw new Error(`Unknown or disabled model: ${selection.modelId}`);
    }
    const override = getModelOverride(profile.id, snapshot);
    const catalogFrontier = profile.suitability.cheap < AUTO_CHEAP_MIN;
    if (catalogFrontier && !override.frontierEligible) {
      throw new Error(`Unknown or disabled model: ${selection.modelId}`);
    }
    if (!catalogFrontier && !override.autoEligible && !override.frontierEligible) {
      throw new Error(`Unknown or disabled model: ${selection.modelId}`);
    }
    const binding = pickBinding(profile, snapshot);
    return {
      modelId: profile.id,
      provider: binding.provider,
      providerModelId: binding.providerModelId,
      reasonCode: "explicit_model",
      profile,
    };
  }

  if (selection.type === "preset") {
    const profile = pickForPreset(snapshot, selection.preset);
    const binding = pickBinding(profile, snapshot);
    return {
      modelId: profile.id,
      provider: binding.provider,
      providerModelId: binding.providerModelId,
      reasonCode: presetReasonCode(selection.preset),
      profile,
    };
  }

  // Auto — purpose-aware for system workloads.
  if (req.purpose === "extraction") {
    const profile =
      resolveModelProfile(process.env.EXTRACTION_MODEL ?? DEFAULT_MODEL_ID) ??
      resolveModelProfile(DEFAULT_MODEL_ID)!;
    if (!isModelEnabledForRouting(profile.id, snapshot)) {
      const fallback = bestBy(snapshot, (m) => m.suitability.cheap, (m) =>
        isModelAutoEligible(m.id, snapshot)
      );
      const binding = pickBinding(fallback, snapshot);
      return {
        modelId: fallback.id,
        provider: binding.provider,
        providerModelId: binding.providerModelId,
        reasonCode: "cost_optimized",
        profile: fallback,
      };
    }
    const binding = pickBinding(profile, snapshot);
    return {
      modelId: profile.id,
      provider: binding.provider,
      providerModelId: binding.providerModelId,
      reasonCode: "cost_optimized",
      profile,
    };
  }

  const { profile, reason } = pickAuto(snapshot, req as InferenceRequest);
  const binding = pickBinding(profile, snapshot);
  return {
    modelId: profile.id,
    provider: binding.provider,
    providerModelId: binding.providerModelId,
    reasonCode: reason,
    profile,
  };
}

/** Async entry that warms the provider-ops cache before routing. */
export async function resolveRouteAsync(
  selection: SelectionPolicy,
  req: Pick<InferenceRequest, "input" | "purpose" | "cheapOnlyRouting">
): Promise<RouteDecision> {
  const snapshot = await ensureProviderOpsSnapshot();
  return resolveRoute(selection, req, snapshot);
}
