import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";

export interface SearchMemoryHit {
  kind: "memory";
  id: string;
  title: string;
  snippet: string;
  href: string;
  created_at: string;
}

export interface SearchConversationHit {
  kind: "conversation";
  id: string;
  title: string;
  snippet: string;
  href: string;
  created_at: string;
}

export interface SearchFileHit {
  kind: "file";
  id: string;
  title: string;
  snippet: string;
  href: string;
  created_at: string;
}

export type SearchHit = SearchMemoryHit | SearchConversationHit | SearchFileHit;

/**
 * Unified Vault search across memories, conversations, and files.
 */
export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({
      memories: [],
      conversations: [],
      files: [],
    });
  }

  const pattern = `%${q}%`;
  const { supabase, user } = ctx;

  const [memoriesRes, sessionsRes, messagesRes, filesRes] = await Promise.all([
    supabase
      .from("memories")
      .select("id, content, created_at")
      .eq("status", "active")
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .ilike("title", pattern)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("chat_messages")
      .select("id, session_id, content, created_at, role")
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("documents")
      .select("id, filename, created_at, status")
      .ilike("filename", pattern)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  if (memoriesRes.error || sessionsRes.error || messagesRes.error || filesRes.error) {
    const msg =
      memoriesRes.error?.message ||
      sessionsRes.error?.message ||
      messagesRes.error?.message ||
      filesRes.error?.message ||
      "Search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const memories: SearchMemoryHit[] = (memoriesRes.data ?? []).map((m) => ({
    kind: "memory" as const,
    id: m.id,
    title: m.content.slice(0, 80),
    snippet: m.content,
    href: `/vault/memories/${m.id}`,
    created_at: m.created_at,
  }));

  const sessionHits = new Map<string, SearchConversationHit>();
  for (const s of sessionsRes.data ?? []) {
    sessionHits.set(s.id, {
      kind: "conversation",
      id: s.id,
      title: s.title?.trim() || "Conversation",
      snippet: s.title ?? "",
      href: `/?session=${s.id}`,
      created_at: s.updated_at ?? s.created_at,
    });
  }

  // Message matches → attach to session (fetch titles for unknown sessions).
  const messageSessionIds = [
    ...new Set(
      (messagesRes.data ?? [])
        .map((m) => m.session_id)
        .filter((id): id is string => Boolean(id) && !sessionHits.has(id))
    ),
  ];

  if (messageSessionIds.length > 0) {
    const { data: extraSessions } = await supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .in("id", messageSessionIds)
      .eq("user_id", user.id);
    for (const s of extraSessions ?? []) {
      if (!sessionHits.has(s.id)) {
        sessionHits.set(s.id, {
          kind: "conversation",
          id: s.id,
          title: s.title?.trim() || "Conversation",
          snippet: "",
          href: `/?session=${s.id}`,
          created_at: s.updated_at ?? s.created_at,
        });
      }
    }
  }

  for (const msg of messagesRes.data ?? []) {
    const existing = sessionHits.get(msg.session_id);
    if (!existing) continue;
    if (!existing.snippet || existing.snippet === existing.title) {
      existing.snippet = msg.content.slice(0, 160);
    }
  }

  const conversations = [...sessionHits.values()].slice(0, 15);

  const files: SearchFileHit[] = (filesRes.data ?? []).map((d) => ({
    kind: "file" as const,
    id: d.id,
    title: d.filename,
    snippet: d.status === "ready" ? "Ready" : d.status,
    href: "/vault/files",
    created_at: d.created_at,
  }));

  return NextResponse.json({ memories, conversations, files });
}
