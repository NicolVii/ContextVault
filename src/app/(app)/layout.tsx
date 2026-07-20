import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const { count } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("status", "proposed");

  return <AppShell reviewCount={count ?? 0}>{children}</AppShell>;
}
