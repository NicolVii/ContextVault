import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-900">Personal profile</h1>
      <p className="text-sm text-brand-600">
        Your profile helps every model understand who it&apos;s talking to.
      </p>
      <div className="mt-6">
        <ProfileForm profile={profile as Profile} email={user.email ?? ""} />
      </div>
    </div>
  );
}
