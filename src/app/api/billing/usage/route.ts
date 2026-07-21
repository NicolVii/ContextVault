import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getPlanUsageSnapshot } from "@/lib/billing/plan-usage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await getPlanUsageSnapshot(ctx.user.id);
  const admin = createSupabaseAdminClient();
  const { data: docs } = await admin
    .from("documents")
    .select("size_bytes")
    .eq("user_id", ctx.user.id);
  const usedBytes = (docs ?? []).reduce((n, d) => n + (Number(d.size_bytes) || 0), 0);

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
