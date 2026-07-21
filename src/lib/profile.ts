import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

/** Resolve a display name from auth user metadata / email (never email itself). */
export function displayNameFromUser(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.display_name === "string" && meta.display_name) ||
    null;
  if (fromMeta) return fromMeta.trim().slice(0, 120) || null;
  if (user.email) return user.email.split("@")[0] ?? null;
  return null;
}

/**
 * Ensure a `profiles` row exists for the signed-in user.
 *
 * New users normally get a row from the `on_auth_user_created` trigger, but
 * hosted projects can miss that migration (or race it). Without a row, the
 * onboarding gate is skipped and profile PATCH fails — so we create one
 * defensively under RLS.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User
): Promise<Profile | null> {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("ensureUserProfile select failed", selectError.message);
  }
  if (existing) {
    // Hosted Google signups often create a row with a null/blank display_name
    // (the auth trigger only reads metadata.display_name, not full_name/name).
    // Backfill once so Profile UI and chat identity stay in sync.
    if (!existing.display_name?.trim()) {
      const fallback = displayNameFromUser(user);
      if (fallback) {
        const { data: updated } = await supabase
          .from("profiles")
          .update({ display_name: fallback })
          .eq("id", user.id)
          .select("*")
          .maybeSingle();
        if (updated) return updated as Profile;
      }
    }
    return existing as Profile;
  }

  const insertPayload = {
    id: user.id,
    display_name: displayNameFromUser(user),
  };

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();

  if (inserted) return inserted as Profile;

  // Concurrent insert (trigger or another request) — fetch again.
  if (insertError) {
    const { data: again } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (again) return again as Profile;
    console.error("ensureUserProfile insert failed", insertError.message);
  }

  return null;
}

/** True when the user still needs the onboarding flow. */
export function needsOnboarding(profile: Pick<Profile, "onboarding_completed"> | null): boolean {
  return !profile || !profile.onboarding_completed;
}
