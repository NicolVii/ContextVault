import { redirect } from "next/navigation";
import { LandingPage } from "@/components/LandingPage";
import { ThinkingShell } from "@/components/ThinkingShell";
import { ThinkingView } from "@/components/ThinkingView";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile, needsOnboarding } from "@/lib/profile";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LandingPage />;
  }

  const profile = await ensureUserProfile(supabase, user);
  if (needsOnboarding(profile)) {
    redirect("/onboarding");
  }

  const { count } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("status", "proposed");

  return (
    <ThinkingShell reviewCount={count ?? 0}>
      <ThinkingView
        displayName={profile?.display_name}
        reviewCount={count ?? 0}
      />
    </ThinkingShell>
  );
}
