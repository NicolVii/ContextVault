import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import {
  getFoundingOfferState,
  getPlanUsageSnapshot,
} from "@/lib/billing/plan-usage";
import { ensureFreeSubscription } from "@/lib/billing/ensure-free";
import { getCommercialCapabilities } from "@/lib/billing/commercial";
import { isVoiceShutdownActive } from "@/lib/admin/system-controls";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  appendServerTiming,
  isPerfTimingEnabled,
  serverTimingMetric,
  timed,
} from "@/lib/perf";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fallback for older / partially provisioned accounts — not a nav hot path.
  await ensureFreeSubscription(ctx.user.id).catch(() => undefined);

  const snapStarted = performance.now();
  const snap = await timed("billing.getPlanUsageSnapshot", () =>
    getPlanUsageSnapshot(ctx.user.id)
  );
  const snapMs = performance.now() - snapStarted;

  const [offer, docsRes, voiceShutdown] = await Promise.all([
    // Reuse snap — avoid a second full entitlement/usage walk.
    getFoundingOfferState(ctx.user.id, snap),
    timed("billing.documentsSizes", async () =>
      createSupabaseAdminClient()
        .from("documents")
        .select("size_bytes")
        .eq("user_id", ctx.user.id)
    ),
    isVoiceShutdownActive(),
  ]);
  const usedBytes = (docsRes.data ?? []).reduce(
    (n, d) => n + (Number(d.size_bytes) || 0),
    0
  );
  const commercial = getCommercialCapabilities();
  const voiceEnabled =
    commercial.featureFlags.voice &&
    snap.entitlements.voice &&
    !voiceShutdown;

  const res = NextResponse.json({
    planId: snap.planId,
    planStatus: snap.planStatus,
    periodEnd: snap.periodEnd,
    currentPeriodEnd: snap.currentPeriodEnd,
    cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
    autoRemaining: snap.autoRemaining,
    frontierRemaining: snap.frontierRemaining,
    frontierHeavy: snap.frontierHeavy,
    inferenceRestricted: snap.inferenceRestricted,
    gracePeriodEndsAt: snap.gracePeriodEndsAt,
    commercialMode: commercial.mode,
    checkoutEnabled: commercial.checkoutEnabled,
    showFoundingOffer:
      offer.showFoundingOffer && commercial.foundingOfferCheckoutEnabled,
    entitlementSource: snap.entitlementSource,
    isDemo: snap.isDemo,
    excludeFromRevenue: snap.excludeFromRevenue,
    showDemoSubscriptionBanner: snap.showDemoSubscriptionBanner,
    entitlementReason: snap.entitlementReason,
    entitlementEndsAt: snap.entitlementEndsAt,
    entitlements: {
      attachments: snap.entitlements.attachments,
      storageBytes: snap.entitlements.storageBytes,
      byok: snap.entitlements.byok,
      voice: voiceEnabled,
      unlimitedAuto: snap.entitlements.unlimitedAuto,
      autoMonthlyTurns: snap.entitlements.autoMonthlyTurns,
      frontierMonthlyTurns: snap.entitlements.frontierMonthlyTurns,
    },
    storageUsedBytes: usedBytes,
  });

  if (isPerfTimingEnabled()) {
    res.headers.set(
      "Server-Timing",
      appendServerTiming(null, serverTimingMetric("plan-snapshot", snapMs))
    );
  }

  return res;
}
