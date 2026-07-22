import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client scoped to the signed-in user. All queries made
 * with this client are subject to Row Level Security, so it is safe to use for
 * user-facing reads and writes.
 *
 * Wrapped in React `cache()` so layouts and pages in the same request share
 * one client instead of rebuilding cookie adapters repeatedly.
 */
export const createSupabaseServerClient = cache(function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // The session refresh is handled by middleware instead.
          }
        },
      },
    }
  );
});
