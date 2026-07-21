import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile, needsOnboarding } from "@/lib/profile";

/**
 * Auth gate for Vault routes. Presentation chrome lives in vault/layout.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await ensureUserProfile(supabase, user);
  if (needsOnboarding(profile)) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
