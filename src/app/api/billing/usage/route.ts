import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import {
  getFoundingOfferState,
  getPlanUsageSnapshot,
} from "@/lib/billing/plan-usage";
import { ensureFreeSubscription } from "@/lib/billing/ensure-free";
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
    showFoundingOffer: offer.showFoundingOffer,
    entitlements: {
      attachments: snap.entitlements.attachments,
      storageBytes: snap.entitlements.storageBytes,
      byok: snap.entitlements.byok,
      voice: snap.entitlements.voice,
      unlimitedAuto: snap.entitlements.unlimitedAuto,
      autoMonthlyTurns: snap.entitlements.autoMonthlyTurns,
      frontierMonthlyTurns: snap.entitlements.frontierMonthlyTurns,
    },
    storageUsedBytes: usedBytes,
  });
}
