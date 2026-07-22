import { redirect } from "next/navigation";
import { LandingPage } from "@/components/LandingPage";
import { ThinkingShell } from "@/components/ThinkingShell";
import { ThinkingView } from "@/components/ThinkingView";
import { getCachedUser, getSessionContext } from "@/lib/auth";
import { ensureUserProfile, needsOnboarding } from "@/lib/profile";
import { timed } from "@/lib/perf";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { session?: string };
}) {
  const user = await getCachedUser();

  if (!user) {
    return <LandingPage />;
  }

  const ctx = await getSessionContext();
  if (!ctx) {
    return <LandingPage />;
  }

  const profile = await timed("home.ensureUserProfile", () =>
    ensureUserProfile(ctx.supabase, user)
  );
  if (needsOnboarding(profile)) {
    redirect("/onboarding");
  }

  const { count } = await timed("home.reviewCount", () =>
    ctx.supabase
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("status", "proposed")
  );

  const sessionParam = searchParams?.session;
  const initialSessionId =
    sessionParam && /^[0-9a-f-]{36}$/i.test(sessionParam) ? sessionParam : null;

  return (
    <ThinkingShell reviewCount={count ?? 0}>
      <ThinkingView
        displayName={profile?.display_name}
        reviewCount={count ?? 0}
        initialSessionId={initialSessionId}
      />
    </ThinkingShell>
  );
}
