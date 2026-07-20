import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
}

/**
 * Fixed-window rate limiter backed by Postgres. Uses the service role so the
 * counter table is never exposed to end users.
 */
export async function checkRateLimit(
  userId: string,
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("increment_rate_limit", {
      p_user_id: userId,
      p_bucket: bucket,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    const count = (data as number) ?? 0;
    return { allowed: count <= limit, count, limit };
  } catch {
    // Fail open on limiter errors so a limiter outage never blocks the app,
    // but never fail open for auth — that is handled separately.
    return { allowed: true, count: 0, limit };
  }
}
