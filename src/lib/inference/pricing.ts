/**
 * In-code price book (seeded to DB in migration). Credits are the customer currency.
 * 1_000 credits ≈ roughly enough for a short cheap-model turn.
 */

export interface PriceBookEntry {
  modelId: string;
  version: number;
  inputCreditsPer1k: number;
  outputCreditsPer1k: number;
  minCredits: number;
  /** COGS analytics (USD micros per 1M tokens). */
  providerInputUsdPer1mMicros: number;
  providerOutputUsdPer1mMicros: number;
}

export const PRICE_BOOK_VERSION = 1;

/** Manual curated prices — margin over typical OpenRouter list rates. */
export const PRICE_BOOK: PriceBookEntry[] = [
  {
    modelId: "openai.gpt-4o-mini",
    version: PRICE_BOOK_VERSION,
    inputCreditsPer1k: 20,
    outputCreditsPer1k: 80,
    minCredits: 10,
    providerInputUsdPer1mMicros: 150_000,
    providerOutputUsdPer1mMicros: 600_000,
  },
  {
    modelId: "openai.gpt-4o",
    version: PRICE_BOOK_VERSION,
    inputCreditsPer1k: 350,
    outputCreditsPer1k: 1400,
    minCredits: 50,
    providerInputUsdPer1mMicros: 2_500_000,
    providerOutputUsdPer1mMicros: 10_000_000,
  },
  {
    modelId: "anthropic.claude-3.5-sonnet",
    version: PRICE_BOOK_VERSION,
    inputCreditsPer1k: 400,
    outputCreditsPer1k: 2000,
    minCredits: 60,
    providerInputUsdPer1mMicros: 3_000_000,
    providerOutputUsdPer1mMicros: 15_000_000,
  },
  {
    modelId: "google.gemini-flash-1.5",
    version: PRICE_BOOK_VERSION,
    inputCreditsPer1k: 15,
    outputCreditsPer1k: 60,
    minCredits: 8,
    providerInputUsdPer1mMicros: 75_000,
    providerOutputUsdPer1mMicros: 300_000,
  },
  {
    modelId: "meta.llama-3.1-70b-instruct",
    version: PRICE_BOOK_VERSION,
    inputCreditsPer1k: 50,
    outputCreditsPer1k: 80,
    minCredits: 15,
    providerInputUsdPer1mMicros: 400_000,
    providerOutputUsdPer1mMicros: 400_000,
  },
];

const byModel = new Map(PRICE_BOOK.map((e) => [e.modelId, e]));

export function getPriceBookEntry(modelId: string): PriceBookEntry {
  return (
    byModel.get(modelId) ?? {
      modelId,
      version: PRICE_BOOK_VERSION,
      inputCreditsPer1k: 100,
      outputCreditsPer1k: 300,
      minCredits: 25,
      providerInputUsdPer1mMicros: 1_000_000,
      providerOutputUsdPer1mMicros: 3_000_000,
    }
  );
}

export function estimateCredits(modelId: string, inputTokens: number, outputTokens: number): number {
  const entry = getPriceBookEntry(modelId);
  const fromTokens =
    Math.ceil((inputTokens / 1000) * entry.inputCreditsPer1k) +
    Math.ceil((outputTokens / 1000) * entry.outputCreditsPer1k);
  return Math.max(entry.minCredits, fromTokens);
}

/** Pre-flight hold: assume a modest reply so we don't block tiny balances unfairly. */
export function estimateCreditsForPreflight(modelId: string, inputTokensEstimate: number): number {
  return estimateCredits(modelId, inputTokensEstimate, Math.min(500, Math.ceil(inputTokensEstimate / 2)));
}

export function providerCostUsdMicros(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const entry = getPriceBookEntry(modelId);
  const input =
    (inputTokens / 1_000_000) * entry.providerInputUsdPer1mMicros;
  const output =
    (outputTokens / 1_000_000) * entry.providerOutputUsdPer1mMicros;
  return Math.round(input + output);
}

export {
  DEFAULT_SIGNUP_CREDITS,
  STANDARD_CONVERSATION_CREDITS,
} from "@/lib/billing/constants";
