import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureCreditAccount } from "@/lib/inference/credits";

/**
 * Ensure every user has an explicit Free subscription row and credit wallet.
 * Never overwrites an active Lite/Pro subscription.
 */
export async function ensureFreeSubscription(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("subscriptions")
    .select("plan_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  const paidActive =
    existing &&
    (existing.plan_id === "lite" || existing.plan_id === "pro") &&
    (existing.status === "active" ||
      existing.status === "trialing" ||
      existing.status === "past_due");

  if (!paidActive) {
    if (!existing) {
      await admin.from("subscriptions").insert({
        user_id: userId,
        plan_id: "free",
        status: "active",
        stripe_subscription_id: null,
        stripe_price_id: null,
        current_period_end: null,
        cancel_at_period_end: false,
      });
    } else if (
      existing.plan_id !== "lite" &&
      existing.plan_id !== "pro"
    ) {
      await admin
        .from("subscriptions")
        .update({
          plan_id: "free",
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else if (
      existing.status === "canceled" ||
      existing.status === "inactive" ||
      existing.status === "unpaid"
    ) {
      await admin
        .from("subscriptions")
        .update({
          plan_id: "free",
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }
  }

  await ensureCreditAccount(userId);

  await admin.from("billing_settings").upsert(
    { user_id: userId },
    { onConflict: "user_id", ignoreDuplicates: true }
  );
}
