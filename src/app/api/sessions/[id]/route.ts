import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";

/** Load a Thinking / chat session with messages for restore. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: session, error: sErr } = await ctx.supabase
    .from("chat_sessions")
    .select("id, title, created_at, updated_at")
    .eq("id", params.id)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages, error: mErr } = await ctx.supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", params.id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  return NextResponse.json({ session, messages: messages ?? [] });
}
