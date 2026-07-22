import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PlanUsagePanel, PlanRecentList } from "@/components/PlanUsagePanel";
import { getCachedUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureCreditAccount, getCreditBalance } from "@/lib/inference/credits";
import { getCommercialCapabilities } from "@/lib/billing/commercial";
import { getPlanUsageSnapshot, type PlanUsageSnapshot } from "@/lib/billing/plan-usage";
import { timed } from "@/lib/perf";

function PlanUsageFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading plan usage">
      <div className="h-16 animate-pulse rounded-2xl bg-mist-100" />
      <div className="h-40 animate-pulse rounded-2xl border border-mist-200 bg-mist-50/50" />
      <div className="h-48 animate-pulse rounded-2xl border border-mist-200 bg-white" />
    </div>
  );
}

function PlanRecentFallback() {
  return (
    <div className="mt-8 space-y-2" aria-busy="true" aria-label="Loading recent usage">
      <div className="h-4 w-20 animate-pulse rounded bg-mist-200/80" />
      <div className="h-24 animate-pulse rounded-xl border border-mist-200 bg-mist-50" />
    </div>
  );
}

async function PlanRecentOnly({
  userId,
  creditBalance,
  snap,
}: {
  userId: string;
  creditBalance: number;
  snap: PlanUsageSnapshot;
}) {
  const recentRes = await timed("vault.plan.recentUsage", () =>
    createSupabaseAdminClient()
      .from("usage_events")
      .select("request_id, purpose, model_id, credits_charged, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12)
  );

  return (
    <div className="mt-8">
      <PlanRecentList
        recent={recentRes.data ?? []}
        creditBalance={creditBalance}
        snap={snap}
      />
    </div>
  );
}

async function PlanUsageSection({ userId }: { userId: string }) {
  await ensureCreditAccount(userId);
  const [balance, snap] = await Promise.all([
    getCreditBalance(userId),
    timed("vault.plan.planSnapshot", () => getPlanUsageSnapshot(userId)),
  ]);
  const commercial = getCommercialCapabilities();

  return (
    <PlanUsagePanel
      snap={snap}
      creditBalance={balance}
      commercialMode={commercial.mode}
      checkoutEnabled={commercial.checkoutEnabled}
      portalEnabled={commercial.portalEnabled}
      allowDevTopup={commercial.devTopupAllowed}
      omitRecent
      recentSlot={
        <Suspense fallback={<PlanRecentFallback />}>
          <PlanRecentOnly userId={userId} creditBalance={balance} snap={snap} />
        </Suspense>
      }
    />
  );
}

async function PlanUsageLoader() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  return <PlanUsageSection userId={user.id} />;
}

/**
 * Sync shell so Soft Navigation can paint chrome immediately. Plan usage and
 * recent activity stream via Suspense. Auth/profile already gated by `(app)/layout`.
 */
export default function VaultPlanPage() {
  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-6 text-sm text-ink-muted">
        One memory. Every leading model. Calm usage — not a wallet.
      </p>
      <Suspense fallback={<PlanUsageFallback />}>
        <PlanUsageLoader />
      </Suspense>
    </div>
  );
}
