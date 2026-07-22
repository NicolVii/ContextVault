import type { ModelPreset, RouteReasonCode, SelectionPolicy } from "./types";

/** Stable product model id (not a provider string). */
export type CortaixModelId = string;

export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  tools: boolean;
  jsonSchema: boolean;
  reasoning: boolean;
  streaming: boolean;
}

export interface ModelLimits {
  contextTokens: number;
  maxOutputTokens: number;
}

export interface ModelSuitability {
  coding: number;
  chat: number;
  longContext: number;
  cheap: number;
  fast: number;
  vision: number;
}

export interface ProviderBinding {
  provider: string;
  providerModelId: string;
}

export interface ModelProfile {
  id: CortaixModelId;
  displayName: string;
  vendor: string;
  status: "active" | "deprecated" | "disabled";
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  suitability: ModelSuitability;
  /** First binding is the default for platform inference. */
  bindings: ProviderBinding[];
  /** Legacy OpenRouter-shaped ids accepted for backwards compatibility. */
  legacyIds: string[];
}

/**
 * Curated catalog. Product code and the ledger always use `id`.
 * Provider adapters receive `bindings[].providerModelId`.
 */
export const MODEL_CATALOG: ModelProfile[] = [
  {
    id: "openai.gpt-4o-mini",
    displayName: "GPT-4o mini",
    vendor: "OpenAI",
    status: "active",
    capabilities: {
      text: true,
      vision: true,
      tools: true,
      jsonSchema: true,
      reasoning: false,
      streaming: true,
    },
    limits: { contextTokens: 128_000, maxOutputTokens: 16_384 },
    suitability: {
      coding: 0.55,
      chat: 0.8,
      longContext: 0.6,
      cheap: 0.95,
      fast: 0.9,
      vision: 0.7,
    },
    bindings: [
      { provider: "openrouter", providerModelId: "openai/gpt-4o-mini" },
      { provider: "openai", providerModelId: "gpt-4o-mini" },
    ],
    legacyIds: ["openai/gpt-4o-mini"],
  },
  {
    id: "openai.gpt-4o",
    displayName: "GPT-4o",
    vendor: "OpenAI",
    status: "active",
    capabilities: {
      text: true,
      vision: true,
      tools: true,
      jsonSchema: true,
      reasoning: false,
      streaming: true,
    },
    limits: { contextTokens: 128_000, maxOutputTokens: 16_384 },
    suitability: {
      coding: 0.75,
      chat: 0.9,
      longContext: 0.65,
      cheap: 0.35,
      fast: 0.55,
      vision: 0.85,
    },
    bindings: [
      { provider: "openrouter", providerModelId: "openai/gpt-4o" },
      { provider: "openai", providerModelId: "gpt-4o" },
    ],
    legacyIds: ["openai/gpt-4o"],
  },
  {
    id: "anthropic.claude-3.5-sonnet",
    displayName: "Claude 3.5 Sonnet",
    vendor: "Anthropic",
    status: "active",
    capabilities: {
      text: true,
      vision: true,
      tools: true,
      jsonSchema: true,
      reasoning: false,
      streaming: true,
    },
    limits: { contextTokens: 200_000, maxOutputTokens: 8192 },
    suitability: {
      coding: 0.95,
      chat: 0.9,
      longContext: 0.85,
      cheap: 0.3,
      fast: 0.45,
      vision: 0.75,
    },
    bindings: [
      { provider: "openrouter", providerModelId: "anthropic/claude-3.5-sonnet" },
      { provider: "anthropic", providerModelId: "claude-3-5-sonnet-20241022" },
    ],
    legacyIds: ["anthropic/claude-3.5-sonnet"],
  },
  {
    id: "google.gemini-flash-1.5",
    displayName: "Gemini 1.5 Flash",
    vendor: "Google",
    status: "active",
    capabilities: {
      text: true,
      vision: true,
      tools: true,
      jsonSchema: true,
      reasoning: false,
      streaming: true,
    },
    limits: { contextTokens: 1_000_000, maxOutputTokens: 8192 },
    suitability: {
      coding: 0.5,
      chat: 0.75,
      longContext: 0.98,
      cheap: 0.9,
      fast: 0.95,
      vision: 0.9,
    },
    bindings: [
      { provider: "openrouter", providerModelId: "google/gemini-flash-1.5" },
      { provider: "google", providerModelId: "gemini-1.5-flash" },
    ],
    legacyIds: ["google/gemini-flash-1.5"],
  },
  {
    id: "meta.llama-3.1-70b-instruct",
    displayName: "Llama 3.1 70B",
    vendor: "Meta",
    status: "active",
    capabilities: {
      text: true,
      vision: false,
      tools: true,
      jsonSchema: true,
      reasoning: false,
      streaming: true,
    },
    limits: { contextTokens: 128_000, maxOutputTokens: 4096 },
    suitability: {
      coding: 0.7,
      chat: 0.7,
      longContext: 0.55,
      cheap: 0.85,
      fast: 0.6,
      vision: 0,
    },
    bindings: [
      {
        provider: "openrouter",
        providerModelId: "meta-llama/llama-3.1-70b-instruct",
      },
      { provider: "groq", providerModelId: "llama-3.1-70b-versatile" },
    ],
    legacyIds: ["meta-llama/llama-3.1-70b-instruct"],
  },
];

export const DEFAULT_MODEL_ID = "openai.gpt-4o-mini";

export const MODEL_PRESETS: {
  id: ModelPreset;
  label: string;
  description: string;
}[] = [
  { id: "fast", label: "Fast", description: "Low latency replies" },
  { id: "smart", label: "Smart", description: "Higher quality reasoning" },
  { id: "coding", label: "Coding", description: "Best for code and debugging" },
  { id: "vision", label: "Vision", description: "Image-capable models" },
  {
    id: "long-context",
    label: "Long context",
    description: "Large documents and long threads",
  },
  { id: "cheap", label: "Cheap", description: "Minimize credit use" },
];

const byId = new Map(MODEL_CATALOG.map((m) => [m.id, m]));
const byLegacy = new Map<string, ModelProfile>();
for (const m of MODEL_CATALOG) {
  for (const legacy of m.legacyIds) byLegacy.set(legacy, m);
}

/** Resolve a cortaix id or legacy provider id to a catalog profile. */
export function resolveModelProfile(idOrLegacy: string): ModelProfile | null {
  return byId.get(idOrLegacy) ?? byLegacy.get(idOrLegacy) ?? null;
}

export function getActiveModels(): ModelProfile[] {
  // Catalog baseline. Runtime routing uses getRoutableModels() with ops overlays.
  return MODEL_CATALOG.filter((m) => m.status === "active");
}

export function defaultBinding(profile: ModelProfile): ProviderBinding {
  const binding = profile.bindings[0];
  if (!binding) {
    throw new Error(`Model ${profile.id} has no provider bindings`);
  }
  return binding;
}

/** Provider model id for the active platform adapter (OpenRouter today). */
export function toProviderModelId(modelId: string): string {
  const profile = resolveModelProfile(modelId);
  if (!profile) return modelId;
  return defaultBinding(profile).providerModelId;
}

/** Normalize any accepted selection string / legacy model id to a SelectionPolicy. */
export function parseSelection(raw: string): SelectionPolicy {
  const value = raw.trim();
  if (!value || value === "auto") return { type: "auto" };
  if (value.startsWith("preset:")) {
    const preset = value.slice("preset:".length) as ModelPreset;
    if (MODEL_PRESETS.some((p) => p.id === preset)) {
      return { type: "preset", preset };
    }
  }
  return { type: "model", modelId: value };
}

export function selectionToStorageKey(selection: SelectionPolicy): string {
  if (selection.type === "auto") return "auto";
  if (selection.type === "preset") return `preset:${selection.preset}`;
  return selection.modelId;
}

export function isValidSelection(raw: string): boolean {
  const selection = parseSelection(raw);
  if (selection.type === "auto" || selection.type === "preset") return true;
  return resolveModelProfile(selection.modelId) !== null;
}

/** UI list: presets first conceptually; models for power users. */
export function chatPickerOptions(): {
  presets: typeof MODEL_PRESETS;
  models: { id: string; label: string; vendor: string }[];
} {
  return {
    presets: MODEL_PRESETS,
    models: getActiveModels().map((m) => ({
      id: m.id,
      label: m.displayName,
      vendor: m.vendor,
    })),
  };
}

export function presetReasonCode(preset: ModelPreset): RouteReasonCode {
  switch (preset) {
    case "fast":
      return "preset_fast";
    case "smart":
      return "preset_smart";
    case "coding":
      return "preset_coding";
    case "vision":
      return "preset_vision";
    case "long-context":
      return "preset_long_context";
    case "cheap":
      return "preset_cheap";
  }
}

/**
 * Back-compat surface previously exported from `src/lib/ai/models.ts`.
 * `id` is now the cortaix model id; legacy OpenRouter ids still validate.
 */
export interface ChatModel {
  id: string;
  label: string;
  vendor: string;
}

export const CHAT_MODELS: ChatModel[] = getActiveModels().map((m) => ({
  id: m.id,
  label: m.displayName,
  vendor: m.vendor,
}));

export function isValidModel(id: string): boolean {
  return isValidSelection(id);
}
