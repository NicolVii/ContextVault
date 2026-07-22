import { redirect } from "next/navigation";
import { PlanUsagePanel } from "@/components/PlanUsagePanel";
import { getCachedUser, getSessionContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureUserProfile } from "@/lib/profile";
import { ensureCreditAccount, getCreditBalance } from "@/lib/inference/credits";
import { getCommercialCapabilities } from "@/lib/billing/commercial";
import { getPlanUsageSnapshot } from "@/lib/billing/plan-usage";
<<<<<<< HEAD
import { timed } from "@/lib/perf";
=======
>>>>>>> origin/main

export default async function VaultPlanPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const profile = await ensureUserProfile(ctx.supabase, user);
  if (!profile) redirect("/onboarding");

  await ensureCreditAccount(user.id);
  const [balance, snap, recentRes] = await Promise.all([
    getCreditBalance(user.id),
    timed("vault.plan.planSnapshot", () => getPlanUsageSnapshot(user.id)),
    createSupabaseAdminClient()
      .from("usage_events")
      .select("request_id, purpose, model_id, credits_charged, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const commercial = getCommercialCapabilities();

  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-6 text-sm text-ink-muted">
        One memory. Every leading model. Calm usage — not a wallet.
      </p>
      <PlanUsagePanel
        snap={snap}
        creditBalance={balance}
        commercialMode={commercial.mode}
        checkoutEnabled={commercial.checkoutEnabled}
        portalEnabled={commercial.portalEnabled}
        allowDevTopup={commercial.devTopupAllowed}
        recent={recentRes.data ?? []}
      />
    </div>
  );
}
