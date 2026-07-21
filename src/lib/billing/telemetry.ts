import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Fire-and-forget commercial telemetry for future tier decisions. */
export async function recordBillingTelemetry(input: {
  userId?: string | null;
  eventName: string;
  planId?: string | null;
  intensity?: string | null;
  modelId?: string | null;
  credits?: number | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("billing_telemetry_events").insert({
      user_id: input.userId ?? null,
      event_name: input.eventName,
      plan_id: input.planId ?? null,
      intensity: input.intensity ?? null,
      model_id: input.modelId ?? null,
      credits: input.credits ?? null,
      meta: input.meta ?? {},
    });
  } catch {
    // Telemetry must never break product paths.
  }
}
