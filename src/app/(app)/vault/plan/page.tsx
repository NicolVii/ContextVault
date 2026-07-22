import { redirect } from "next/navigation";
import { PlanUsagePanel } from "@/components/PlanUsagePanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureUserProfile } from "@/lib/profile";
import { ensureCreditAccount, getCreditBalance } from "@/lib/inference/credits";
import { getCommercialCapabilities } from "@/lib/billing/commercial";
import { getPlanUsageSnapshot } from "@/lib/billing/plan-usage";
import { ensureFreeSubscription } from "@/lib/billing/ensure-free";

export default async function VaultPlanPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await ensureUserProfile(supabase, user);
  if (!profile) redirect("/onboarding");

  await ensureFreeSubscription(user.id);
  await ensureCreditAccount(user.id);
  const [balance, snap, recentRes] = await Promise.all([
    getCreditBalance(user.id),
    getPlanUsageSnapshot(user.id),
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
