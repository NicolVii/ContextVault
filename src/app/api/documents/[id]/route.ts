import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: doc } = await ctx.supabase
    .from("documents")
    .select("storage_path")
    .eq("id", params.id)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Remove the stored file, then the row (chunks cascade via FK).
  await ctx.supabase.storage.from("documents").remove([doc.storage_path]);
  const { error } = await ctx.supabase.from("documents").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAudit({
    userId: ctx.user.id,
    action: "document.delete",
    entityType: "document",
    entityId: params.id,
  });

  return NextResponse.json({ ok: true });
}
