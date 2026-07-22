import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Append an admin-console action to admin_audit_log. Uses the service role
 * (table has no authenticated write policies). Best-effort: failures are
 * logged but do not break the caller.
 */
export async function recordAdminAudit(params: {
  actorUserId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("admin_audit_log").insert({
      actor_user_id: params.actorUserId,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      metadata: params.metadata ?? {},
    });
    if (error) {
      console.error("admin audit log write failed", error.message);
    }
  } catch (err) {
    console.error("admin audit log write failed", err);
  }
}
