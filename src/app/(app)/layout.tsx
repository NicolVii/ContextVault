import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile, needsOnboarding } from "@/lib/profile";

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

  // Missing row OR incomplete onboarding → force the setup flow.
  // (Previously a missing row skipped this gate entirely.)
  if (needsOnboarding(profile)) {
    redirect("/onboarding");
  }

  const { count } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("status", "proposed");

  return <AppShell reviewCount={count ?? 0}>{children}</AppShell>;
}
