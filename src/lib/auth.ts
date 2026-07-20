import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionContext {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  user: User;
}

/**
 * Resolve the authenticated user for a route handler. Returns null when there
 * is no valid session so callers can respond with 401.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}
