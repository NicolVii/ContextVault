import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  estimateCredits,
  getPriceBookEntry,
  providerCostUsdMicros,
  PRICE_BOOK_VERSION,
} from "./pricing";
import type { UsageDraft } from "./types";

export interface SettlementResult {
  alreadySettled: boolean;
  creditsCharged: number;
  balanceAfter: number | null;
}

/** Pure credit calculation — BYOK and mock never debit the Cortaix wallet. */
export function computeCreditsCharged(
  draft: Pick<UsageDraft, "billingMode" | "provider" | "modelId" | "measures">
): number {
  if (draft.billingMode === "byok" || draft.provider === "mock") return 0;
  const inputTokens = draft.measures.inputTokens ?? 0;
  const outputTokens = draft.measures.outputTokens ?? 0;
  return estimateCredits(draft.modelId, inputTokens, outputTokens);
}

export interface SettleUsageOptions {
  latencyMs?: number | null;
  failoverCount?: number;
}

/**
 * Idempotent usage settlement keyed by request_id.
 * Writes usage_events and debits the credit wallet when billingMode=platform
 * and credits_charged > 0. Failover retries share one request_id → one debit.
 */
export async function settleUsage(
  draft: UsageDraft,
  options?: SettleUsageOptions
): Promise<SettlementResult> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("usage_events")
    .select("credits_charged")
    .eq("request_id", draft.requestId)
    .maybeSingle();

  if (existing) {
    return {
      alreadySettled: true,
      creditsCharged: existing.credits_charged as number,
      balanceAfter: null,
    };
  }

  const inputTokens = draft.measures.inputTokens ?? 0;
  const outputTokens = draft.measures.outputTokens ?? 0;
  const totalTokens =
    draft.measures.totalTokens ??
    (inputTokens + outputTokens > 0 ? inputTokens + outputTokens : 0);

  const creditsCharged = computeCreditsCharged(draft);

  const providerCost =
    draft.provider === "mock"
      ? 0
      : providerCostUsdMicros(draft.modelId, inputTokens, outputTokens);

  const priceBook = getPriceBookEntry(draft.modelId);

  const { error: insertErr } = await admin.from("usage_events").insert({
    request_id: draft.requestId,
    tenant_id: draft.tenantId,
    user_id: draft.userId,
    purpose: draft.purpose,
    model_id: draft.modelId,
    provider: draft.provider,
    provider_model_id: draft.providerModelId,
    billing_mode: draft.billingMode,
    input_tokens: inputTokens || null,
    output_tokens: outputTokens || null,
    total_tokens: totalTokens || null,
    embedding_units: draft.measures.embeddingUnits ?? null,
    image_units: draft.measures.imageUnits ?? null,
    measures_source: draft.measuresSource,
    provider_cost_usd_micros: providerCost,
    credits_charged: creditsCharged,
    price_book_version: priceBook.version || PRICE_BOOK_VERSION,
    latency_ms: options?.latencyMs ?? null,
    failover_count: options?.failoverCount ?? 0,
  });

  if (insertErr) {
    // Unique violation → concurrent settle won.
    if (insertErr.code === "23505") {
      return { alreadySettled: true, creditsCharged, balanceAfter: null };
    }
    throw insertErr;
  }

  let balanceAfter: number | null = null;
  if (creditsCharged > 0) {
    const { data, error } = await admin.rpc("apply_credit_delta", {
      p_user_id: draft.userId,
      p_delta: -creditsCharged,
      p_request_id: draft.requestId,
      p_reason: "usage",
    });
    if (error) throw error;
    balanceAfter = data as number;
  }

  return { alreadySettled: false, creditsCharged, balanceAfter };
}
