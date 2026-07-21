/**
 * Provider-agnostic inference contracts.
 * Memory / billing / conversation must not import provider SDKs — only these shapes.
 */

export type InferencePurpose =
  | "chat"
  | "extraction"
  | "summarize"
  | "embed";

export type BillingMode = "platform" | "byok";

export type MeasuresSource = "provider" | "estimated" | "normalized";

export type ModelPreset =
  | "fast"
  | "smart"
  | "coding"
  | "vision"
  | "long-context"
  | "cheap";

export type SelectionPolicy =
  | { type: "auto" }
  | { type: "preset"; preset: ModelPreset }
  | { type: "model"; modelId: string };

export interface UsageMeasures {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  embeddingUnits?: number;
  imageUnits?: number;
  audioSeconds?: number;
  /** Extensible named quantities for vendor-specific dims. */
  [key: string]: number | undefined;
}

/** Canonical usage draft — never vendor-shaped. */
export interface UsageDraft {
  requestId: string;
  tenantId: string;
  userId: string;
  purpose: InferencePurpose;
  modelId: string;
  provider: string;
  providerModelId: string;
  billingMode: BillingMode;
  measures: UsageMeasures;
  measuresSource: MeasuresSource;
  providerRawRef?: string;
}

export interface ChatMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface InferenceRequest {
  requestId: string;
  tenantId: string;
  userId: string;
  purpose: InferencePurpose;
  input: {
    messages: ChatMessageInput[];
    /** Approximate context size in characters (for long-context auto routing). */
    contextChars?: number;
    hasVisionAttachment?: boolean;
  };
  selection: SelectionPolicy;
  constraints?: {
    maxOutputTokens?: number;
    temperature?: number;
    json?: boolean;
  };
  billingMode: BillingMode;
}

export type RouteReasonCode =
  | "explicit_model"
  | "preset_fast"
  | "preset_smart"
  | "preset_coding"
  | "preset_vision"
  | "preset_long_context"
  | "preset_cheap"
  | "vision_required"
  | "long_context_required"
  | "coding_heuristic"
  | "cost_optimized"
  | "sticky_session"
  | "fallback_default";

export interface InferenceResult {
  requestId: string;
  output: {
    message: string;
    finishReason?: string;
  };
  resolved: {
    modelId: string;
    provider: string;
    providerModelId: string;
    reasonCode: RouteReasonCode;
  };
  usage: UsageDraft;
  meta: {
    latencyMs: number;
    mocked: boolean;
  };
}
