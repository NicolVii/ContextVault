import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. This BYPASSES Row Level Security and must only
 * ever be used on the server for tightly-scoped operations (audit logging,
 * rate limiting, background writes) where we set user_id explicitly ourselves.
 * NEVER expose the service role key or this client to the browser.
 */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
