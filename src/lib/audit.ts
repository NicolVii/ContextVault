import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Append a security-relevant action to the audit log. Best-effort: failures are
 * swallowed so auditing never breaks a user action, but they are logged.
 */
export async function recordAudit(params: {
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("audit_log").insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error("audit log write failed", err);
  }
}
