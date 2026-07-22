import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { appendServerTiming, isPerfTimingEnabled, serverTimingMetric } from "@/lib/perf";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PROTECTED_PREFIXES = [
  "/vault",
  "/dashboard",
  "/memories",
  "/review",
  "/documents",
  "/chat",
  "/profile",
  "/settings",
  "/onboarding",
  "/admin",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const authStarted = performance.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authMs = performance.now() - authStarted;

  if (isPerfTimingEnabled()) {
    console.info(`[perf] middleware.auth: ${authMs.toFixed(1)}ms`);
    response.headers.set(
      "Server-Timing",
      appendServerTiming(
        response.headers.get("Server-Timing"),
        serverTimingMetric("mw-auth", authMs)
      )
    );
  }

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  return response;
}
