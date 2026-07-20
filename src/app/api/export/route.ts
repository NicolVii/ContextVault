import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = ctx;
  const [{ data: memories }, { data: documents }, { data: profile }] =
    await Promise.all([
      supabase.from("memories").select("*").neq("status", "deleted"),
      supabase.from("documents").select("id, filename, mime_type, page_count, created_at"),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    ]);

  const payload = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    profile,
    memories: memories ?? [],
    documents: documents ?? [],
  };

  await recordAudit({
    userId: user.id,
    action: "data.export",
    metadata: { memory_count: memories?.length ?? 0 },
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="context-vault-export-${Date.now()}.json"`,
    },
  });
}
