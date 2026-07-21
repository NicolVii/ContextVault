import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { profileSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { ensureUserProfile } from "@/lib/profile";
import {
  isValidSelection,
  parseSelection,
  resolveModelProfile,
  selectionToStorageKey,
} from "@/lib/inference/models";

export async function PATCH(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updates = { ...parsed.data };
  if (updates.default_model) {
    if (!isValidSelection(updates.default_model)) {
      return NextResponse.json({ error: "Unknown model or selection" }, { status: 400 });
    }
    const selection = parseSelection(updates.default_model);
    if (selection.type === "model") {
      const profile = resolveModelProfile(selection.modelId);
      updates.default_model = profile?.id ?? updates.default_model;
    } else {
      updates.default_model = selectionToStorageKey(selection);
    }
  }

  // Guarantees a row exists even if the auth trigger never ran (common when
  // hosted migrations are incomplete). Then apply the requested fields.
  const ensured = await ensureUserProfile(ctx.supabase, ctx.user);
  if (!ensured) {
    return NextResponse.json(
      { error: "Could not create your profile. Check that database migrations and grants are applied." },
      { status: 500 }
    );
  }

  const { data, error } = await ctx.supabase
    .from("profiles")
    .update(updates)
    .eq("id", ctx.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAudit({
    userId: ctx.user.id,
    action: "profile.update",
    entityType: "profile",
    entityId: ctx.user.id,
  });

  return NextResponse.json({ profile: data });
}
