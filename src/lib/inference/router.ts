import {
  DEFAULT_MODEL_ID,
  defaultBinding,
  getActiveModels,
  presetReasonCode,
  resolveModelProfile,
  type ModelProfile,
} from "./models";
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

function bestBy(
  score: (m: ModelProfile) => number,
  predicate: (m: ModelProfile) => boolean = () => true
): ModelProfile {
  const candidates = getActiveModels().filter(predicate);
  if (candidates.length === 0) {
    const fallback = resolveModelProfile(DEFAULT_MODEL_ID);
    if (!fallback) throw new Error("Default model missing from catalog");
    return fallback;
  }
  return candidates.reduce((best, cur) => (score(cur) > score(best) ? cur : best));
}

function pickForPreset(preset: ModelPreset): ModelProfile {
  switch (preset) {
    case "fast":
      return bestBy((m) => m.suitability.fast);
    case "smart":
      return bestBy((m) => m.suitability.chat * 0.6 + m.suitability.coding * 0.4);
    case "coding":
      return bestBy((m) => m.suitability.coding);
    case "vision":
      return bestBy((m) => m.suitability.vision, (m) => m.capabilities.vision);
    case "long-context":
      return bestBy((m) => m.suitability.longContext);
    case "cheap":
      return bestBy((m) => m.suitability.cheap);
  }
}

function pickAuto(req: InferenceRequest): { profile: ModelProfile; reason: RouteReasonCode } {
  if (req.input.hasVisionAttachment) {
    return {
      profile: bestBy((m) => m.suitability.vision, (m) => m.capabilities.vision),
      reason: "vision_required",
    };
  }

  const contextChars = req.input.contextChars ?? 0;
  if (contextChars >= LONG_CONTEXT_CHAR_THRESHOLD) {
    return {
      profile: bestBy((m) => m.suitability.longContext),
      reason: "long_context_required",
    };
  }

  const lastUser = [...req.input.messages].reverse().find((m) => m.role === "user");
  if (lastUser && CODING_HINT.test(lastUser.content)) {
    return {
      profile: bestBy((m) => m.suitability.coding),
      reason: "coding_heuristic",
    };
  }

  return {
    profile: bestBy((m) => m.suitability.cheap * 0.6 + m.suitability.fast * 0.4),
    reason: "cost_optimized",
  };
}

/**
 * Deterministic, explainable model selection.
 * Honor explicit model → preset → auto signals. No LLM-in-the-loop.
 */
export function resolveRoute(
  selection: SelectionPolicy,
  req: Pick<InferenceRequest, "input" | "purpose">
): RouteDecision {
  if (selection.type === "model") {
    const profile = resolveModelProfile(selection.modelId);
    if (!profile || profile.status !== "active") {
      throw new Error(`Unknown or disabled model: ${selection.modelId}`);
    }
    const binding = defaultBinding(profile);
    return {
      modelId: profile.id,
      provider: binding.provider,
      providerModelId: binding.providerModelId,
      reasonCode: "explicit_model",
      profile,
    };
  }

  if (selection.type === "preset") {
    const profile = pickForPreset(selection.preset);
    const binding = defaultBinding(profile);
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
    const binding = defaultBinding(profile);
    return {
      modelId: profile.id,
      provider: binding.provider,
      providerModelId: binding.providerModelId,
      reasonCode: "cost_optimized",
      profile,
    };
  }

  const { profile, reason } = pickAuto(req as InferenceRequest);
  const binding = defaultBinding(profile);
  return {
    modelId: profile.id,
    provider: binding.provider,
    providerModelId: binding.providerModelId,
    reasonCode: reason,
    profile,
  };
}
