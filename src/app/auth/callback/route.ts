import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile, needsOnboarding } from "@/lib/profile";
import { ensureFreeSubscription } from "@/lib/billing/ensure-free";

/**
 * OAuth (PKCE) callback. Supabase redirects here with a `code` after the user
 * authenticates with an external provider (e.g. Google). We exchange the code
 * for a session (which sets the auth cookies), ensure a profile row exists,
 * and send new / incomplete users to onboarding.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profile = await ensureUserProfile(supabase, user);
    // Provision free plan once at signup/OAuth — not on every navigation.
    await ensureFreeSubscription(user.id).catch(() => undefined);
    if (needsOnboarding(profile)) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  // Only allow relative in-app redirects.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
