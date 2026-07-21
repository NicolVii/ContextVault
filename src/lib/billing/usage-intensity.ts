import { resolveModelProfile } from "@/lib/inference/models";
import type { SelectionPolicy } from "@/lib/inference/types";

/**
 * Product taxonomy: Auto (efficient path) vs Frontier (premium models).
 * Classification drives entitlement pools — not customer-facing credit math.
 */

export type UsageIntensity = "auto" | "frontier";

/** Models with cheap suitability at or above this are Auto-class. */
export const AUTO_CHEAP_THRESHOLD = 0.7;

export function isFrontierModelId(modelId: string): boolean {
  const profile = resolveModelProfile(modelId);
  if (!profile) return true;
  return profile.suitability.cheap < AUTO_CHEAP_THRESHOLD;
}

export function isAutoModelId(modelId: string): boolean {
  return !isFrontierModelId(modelId);
}

/**
 * Classify a turn from selection intent + resolved model.
 * Explicit Auto / cheap / fast → Auto pool.
 * Explicit frontier models and smart/coding/vision/long-context presets → Frontier
 * when the resolved model is Frontier-class; otherwise Auto.
 */
export function classifyUsageIntensity(
  selection: SelectionPolicy,
  resolvedModelId: string
): UsageIntensity {
  if (selection.type === "auto") return "auto";
  if (selection.type === "preset") {
    if (selection.preset === "cheap" || selection.preset === "fast") return "auto";
    return isFrontierModelId(resolvedModelId) ? "frontier" : "auto";
  }
  return isFrontierModelId(resolvedModelId) ? "frontier" : "auto";
}

export function modelIntensityLabel(modelId: string): "Low" | "Medium" | "High" {
  const profile = resolveModelProfile(modelId);
  if (!profile) return "High";
  if (profile.suitability.cheap >= 0.85) return "Low";
  if (profile.suitability.cheap >= 0.5) return "Medium";
  return "High";
}
