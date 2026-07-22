import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { timed } from "@/lib/perf";
import { requestCache } from "@/lib/request-cache";

export interface SessionContext {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  user: User;
}

/**
 * Resolve the authenticated user once per React server request.
 * Safe for layouts + pages to call repeatedly; does not replace middleware
 * session refresh.
 */
export const getCachedUser = requestCache(async (): Promise<User | null> => {
  return timed("auth.getUser", async () => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  });
});

/**
 * Resolve the authenticated user for a route handler / RSC. Returns null when
 * there is no valid session so callers can respond with 401 / redirect.
 */
export const getSessionContext = requestCache(async (): Promise<SessionContext | null> => {
  const supabase = createSupabaseServerClient();
  const user = await getCachedUser();
  if (!user) return null;
  return { supabase, user };
});
