import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/LandingPage";
import { ThinkingShell } from "@/components/ThinkingShell";
import { ThinkingView } from "@/components/ThinkingView";
import { getCachedUser, getSessionContext } from "@/lib/auth";
import { ensureUserProfile, needsOnboarding } from "@/lib/profile";
import { timed } from "@/lib/perf";

async function ReviewCountBadge() {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const { count } = await timed("home.reviewCount", () =>
    ctx.supabase
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("status", "proposed")
  );
  const n = count ?? 0;
  if (n <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-amber-500 px-1 text-[10px] font-semibold text-white">
      {n > 9 ? "9+" : n}
    </span>
  );
}

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

  const sessionParam = searchParams?.session;
  const initialSessionId =
    sessionParam && /^[0-9a-f-]{36}$/i.test(sessionParam) ? sessionParam : null;

  return (
    <ThinkingShell
      reviewBadge={
        <Suspense fallback={null}>
          <ReviewCountBadge />
        </Suspense>
      }
    >
      <ThinkingView
        displayName={profile?.display_name}
        reviewCount={0}
        initialSessionId={initialSessionId}
      />
    </ThinkingShell>
  );
}
