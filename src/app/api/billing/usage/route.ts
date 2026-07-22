import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import {
  getFoundingOfferState,
  getPlanUsageSnapshot,
} from "@/lib/billing/plan-usage";
import { ensureFreeSubscription } from "@/lib/billing/ensure-free";
import { getCommercialCapabilities } from "@/lib/billing/commercial";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureFreeSubscription(ctx.user.id).catch(() => undefined);

  const [snap, offer, docsRes] = await Promise.all([
    getPlanUsageSnapshot(ctx.user.id),
    getFoundingOfferState(ctx.user.id),
    createSupabaseAdminClient()
      .from("documents")
      .select("size_bytes")
      .eq("user_id", ctx.user.id),
  ]);
  const usedBytes = (docsRes.data ?? []).reduce(
    (n, d) => n + (Number(d.size_bytes) || 0),
    0
  );
  const commercial = getCommercialCapabilities();
  const voiceEnabled =
    commercial.featureFlags.voice && snap.entitlements.voice;

  return NextResponse.json({
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
}
