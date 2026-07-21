import { redirect } from "next/navigation";
import { PlanUsagePanel } from "@/components/PlanUsagePanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureUserProfile } from "@/lib/profile";
import { ensureCreditAccount, getCreditBalance } from "@/lib/inference/credits";
import { isStripeConfigured } from "@/lib/billing/products";
import { isDevTopupAllowed } from "@/lib/billing/dev-topup";
import { getPlanUsageSnapshot } from "@/lib/billing/plan-usage";

export default async function VaultPlanPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await ensureUserProfile(supabase, user);
  if (!profile) redirect("/onboarding");

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

  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-6 text-sm text-ink-muted">
        One memory. Every leading model. Calm usage — not a wallet.
      </p>
      <PlanUsagePanel
        snap={snap}
        creditBalance={balance}
        stripeConfigured={isStripeConfigured()}
        allowDevTopup={isDevTopupAllowed()}
        recent={recentRes.data ?? []}
      />
    </div>
  );
}
