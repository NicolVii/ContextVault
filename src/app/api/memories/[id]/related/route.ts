import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getMemoryProvider } from "@/lib/memory";
import type { RetrievedMemory } from "@/lib/types";

const MIN_SIMILARITY = 0.05;

/**
 * Related memories derived from semantic similarity to this memory's content.
 * Excludes the source memory itself.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 8) || 8, 20);

  const { data: memory, error } = await ctx.supabase
    .from("memories")
    .select("id, content, status")
    .eq("id", params.id)
    .neq("status", "deleted")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!memory) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const provider = getMemoryProvider();
  let related: RetrievedMemory[] = [];
  try {
    const retrieved = await provider.retrieve(ctx.supabase, ctx.user.id, memory.content, {
      limit: limit + 4,
    });
    related = retrieved
      .filter((m) => m.id !== memory.id && m.similarity >= MIN_SIMILARITY)
      .slice(0, limit);
  } catch (err) {
    console.error("related memories retrieve failed", err);
    return NextResponse.json({ error: "Could not find related memories" }, { status: 500 });
  }

  // Also surface same-category active memories when semantic results are thin.
  if (related.length < 3) {
    const { data: source } = await ctx.supabase
      .from("memories")
      .select("category")
      .eq("id", params.id)
      .maybeSingle();

    if (source?.category) {
      const { data: sameCategory } = await ctx.supabase
        .from("memories")
        .select(
          "id, content, category, type, source, source_detail, confidence, created_at"
        )
        .eq("status", "active")
        .eq("category", source.category)
        .neq("id", params.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      const have = new Set(related.map((r) => r.id));
      for (const row of sameCategory ?? []) {
        if (have.has(row.id)) continue;
        related.push({
          ...(row as Omit<RetrievedMemory, "similarity">),
          similarity: 0.1,
        });
        if (related.length >= limit) break;
      }
    }
  }

  return NextResponse.json({
    memoryId: params.id,
    related,
  });
}
