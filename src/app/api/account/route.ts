import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getMemoryProvider } from "@/lib/memory";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit";

/**
 * Permanently delete either all memories or the entire account. Callers must
 * pass an explicit confirmation flag; the UI additionally requires the user to
 * type a confirmation phrase before this is invoked.
 */
export async function DELETE(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || body.confirm !== true) {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }
  const scope = body.scope === "account" ? "account" : "memories";
  const { supabase, user } = ctx;

  if (scope === "memories") {
    await getMemoryProvider().removeAll(supabase, user.id);
    const { error } = await supabase
      .from("memories")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordAudit({ userId: user.id, action: "memory.delete_all" });
    return NextResponse.json({ ok: true, scope });
  }

  // Full account deletion. Remove stored files, then delete the auth user,
  // which cascades to every table via ON DELETE CASCADE foreign keys.
  await recordAudit({ userId: user.id, action: "account.delete" });
  await getMemoryProvider().removeAll(supabase, user.id);
  const admin = createSupabaseAdminClient();

  const { data: files } = await admin.storage.from("documents").list(user.id, {
    limit: 1000,
  });
  // Storage list is shallow; remove per-document folders.
  const { data: docs } = await supabase.from("documents").select("storage_path");
  const paths = (docs ?? []).map((d) => d.storage_path);
  if (paths.length > 0) await admin.storage.from("documents").remove(paths);
  void files;

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true, scope });
}
