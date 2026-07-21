/**
 * Back-compat surface for Thinking / Vault UI.
 * Canonical catalog lives in `@/lib/inference/models`.
 */
export {
  CHAT_MODELS,
  type ChatModel,
  DEFAULT_MODEL_ID,
  MODEL_PRESETS,
  parseSelection,
  isValidSelection,
  chatPickerOptions,
  toProviderModelId,
  resolveModelProfile,
  selectionToStorageKey,
} from "@/lib/inference/models";

import {
  CHAT_MODELS,
  DEFAULT_MODEL_ID,
  isValidSelection,
  resolveModelProfile,
} from "@/lib/inference/models";

/** Session / request value meaning “use the user’s default model” / router Auto. */
export const AUTO_MODEL_ID = "auto" as const;

export function isValidModel(id: string): boolean {
  return id === AUTO_MODEL_ID || isValidSelection(id);
}

export function modelLabel(id: string): string {
  if (id === AUTO_MODEL_ID) return "Auto";
  if (id.startsWith("preset:")) {
    const preset = id.slice("preset:".length);
    return preset.charAt(0).toUpperCase() + preset.slice(1).replace(/-/g, " ");
  }
  const profile = resolveModelProfile(id);
  if (profile) return profile.displayName;
  return CHAT_MODELS.find((m) => m.id === id)?.label ?? id;
}

/** Friendly label for display when Auto resolved to a concrete model. */
export function resolvedModelDisplay(choice: string, resolvedId: string): string {
  if (choice === AUTO_MODEL_ID) {
    const resolved = modelLabel(resolvedId);
    return resolved === resolvedId ? "Auto" : `Auto (${resolved})`;
  }
  if (choice.startsWith("preset:")) {
    return `${modelLabel(choice)} (${modelLabel(resolvedId)})`;
  }
  return modelLabel(choice);
}

export { DEFAULT_MODEL_ID };
