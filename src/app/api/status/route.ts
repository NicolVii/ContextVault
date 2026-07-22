import { NextResponse } from "next/server";
import { getChatProvider, readOpenRouterApiKey, resetChatProviderCache } from "@/lib/ai";
import { getEmbeddingProvider } from "@/lib/embeddings";
import { getMemoryProvider } from "@/lib/memory";
import { getExtractionProvider, resetExtractionProviderCache } from "@/lib/memory/extraction";
import { getCommercialCapabilities } from "@/lib/billing/commercial";

/** Always read live process env — never bake this at build time. */
export const dynamic = "force-dynamic";

/**
 * Safe runtime diagnostics for production debugging. Never returns secrets —
 * only whether they are present and which providers were selected.
 *
 * Open on your phone: https://your-app.vercel.app/api/status
 */
export async function GET() {
  // Re-resolve so this reflects the current process env (not a stale cache
  // from an earlier request in the same warm serverless instance).
  resetChatProviderCache();
  resetExtractionProviderCache();

  const openRouterKey = readOpenRouterApiKey();
  const chat = getChatProvider();
  const embeddings = getEmbeddingProvider();
  const memory = getMemoryProvider();
  const extraction = getExtractionProvider();

  const commercial = getCommercialCapabilities();

  return NextResponse.json({
    ok: true,
    chat: {
      provider: chat.name,
      openRouterKeyConfigured: Boolean(openRouterKey),
      openRouterKeyLength: openRouterKey ? openRouterKey.length : 0,
      hint:
        chat.name === "mock"
          ? "OPENROUTER_API_KEY is missing in this deployment's environment. In Vercel: Settings → Environment Variables → add OPENROUTER_API_KEY for Production → Redeploy the Production deployment."
          : "OpenRouter chat provider is active.",
    },
    inference: {
      router: "deterministic",
      metering: "usage_events",
      billing: "credit_wallet",
    },
    commercial: {
      mode: commercial.mode,
      stripeConfigured: commercial.stripeConfigured,
      checkoutEnabled: commercial.checkoutEnabled,
      portalEnabled: commercial.portalEnabled,
      featureFlags: commercial.featureFlags,
    },
    embeddings: { provider: embeddings.name },
    memory: { provider: memory.name },
    extraction: { provider: extraction.name },
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
