import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { profileSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

export async function PATCH(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("profiles")
    .update(parsed.data)
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
