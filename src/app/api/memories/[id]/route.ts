import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getMemoryProvider } from "@/lib/memory";
import { updateMemorySchema } from "@/lib/validation";
import { isSensitive } from "@/lib/memory/redaction";
import { recordAudit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = updateMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.content !== undefined) {
    updates.is_sensitive = isSensitive(parsed.data.content);
  }

  const { data, error } = await ctx.supabase
    .from("memories")
    .update(updates)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Keep the embedding in sync when the content changes.
  if (parsed.data.content !== undefined) {
    await getMemoryProvider().reembed(ctx.supabase, params.id, parsed.data.content);
  }

  await recordAudit({
    userId: ctx.user.id,
    action: parsed.data.status ? `memory.status.${parsed.data.status}` : "memory.update",
    entityType: "memory",
    entityId: params.id,
    metadata: { status: parsed.data.status },
  });

  return NextResponse.json({ memory: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await ctx.supabase
    .from("memories")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAudit({
    userId: ctx.user.id,
    action: "memory.delete",
    entityType: "memory",
    entityId: params.id,
  });

  return NextResponse.json({ ok: true });
}
