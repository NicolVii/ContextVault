import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordBillingTelemetry } from "./telemetry";

/** Called from product paths: restrict inference after payment-failure grace ends. */
export async function applyGraceExpiryIfNeeded(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("billing_settings")
    .select("grace_period_ends_at, inference_restricted")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.grace_period_ends_at || data.inference_restricted) {
    return Boolean(data?.inference_restricted);
  }
  if (new Date(data.grace_period_ends_at as string) > new Date()) return false;
  await admin
    .from("billing_settings")
    .update({
      inference_restricted: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  await recordBillingTelemetry({
    userId,
    eventName: "inference_restricted",
    meta: { reason: "grace_expired" },
  });
  return true;
}
