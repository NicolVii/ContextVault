import { redirect } from "next/navigation";
import { getCachedUser, getSessionContext } from "@/lib/auth";
import { ensureUserProfile, needsOnboarding } from "@/lib/profile";
import { timed } from "@/lib/perf";

/**
 * Auth gate for Vault routes. Presentation chrome lives in vault/layout.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const profile = await timed("layout.ensureUserProfile", () =>
    ensureUserProfile(ctx.supabase, user)
  );
  if (needsOnboarding(profile)) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
