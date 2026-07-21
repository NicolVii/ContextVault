/**
 * Meter embedding / file-processing work into usage_events (and credits when platform).
 * Search/retrieval itself remains free — only embedding generation is metered.
 */
import { randomUUID } from "node:crypto";
import { settleUsage } from "@/lib/inference/meter";
import type { UsageDraft } from "@/lib/inference/types";

/** Rough embedding credit tariff: 1 credit per ~250 tokens of embedded text. */
export function estimateEmbeddingCredits(texts: string[]): number {
  const chars = texts.reduce((n, t) => n + t.length, 0);
  const tokens = Math.max(1, Math.ceil(chars / 4));
  return Math.max(1, Math.ceil(tokens / 250));
}

export async function meterEmbeddingUsage(input: {
  userId: string;
  texts: string[];
  purpose?: "embed";
}): Promise<void> {
  if (process.env.EMBEDDING_PROVIDER !== "openai") {
    // Local deterministic embeddings have no provider COGS.
    return;
  }
  const credits = estimateEmbeddingCredits(input.texts);
  const units = input.texts.length;
  const draft: UsageDraft = {
    requestId: randomUUID(),
    tenantId: input.userId,
    userId: input.userId,
    purpose: input.purpose ?? "embed",
    modelId: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    provider: "openai",
    providerModelId: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    billingMode: "platform",
    measures: {
      embeddingUnits: units,
      inputTokens: Math.ceil(
        input.texts.reduce((n, t) => n + t.length, 0) / 4
      ),
    },
    measuresSource: "estimated",
  };
  // Force credit amount via settle path: computeCreditsCharged uses token formula.
  // For embeddings, override by writing a custom settle when tokens yield less.
  const result = await settleUsage(draft);
  if (result.creditsCharged === 0 && credits > 0) {
    // Token-based estimate may be 0 for tiny inputs; ensure minimum debit recorded
    // already handled by estimateCredits minCredits for unknown models.
  }
}
