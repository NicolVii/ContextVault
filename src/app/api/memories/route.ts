import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getMemoryProvider } from "@/lib/memory";
import { isSensitive } from "@/lib/memory/redaction";
import { createMemorySchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { recordAudit } from "@/lib/audit";
import {
  appendServerTiming,
  isPerfTimingEnabled,
  serverTimingMetric,
  timed,
} from "@/lib/perf";

export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const search = url.searchParams.get("q");

  const started = performance.now();
  const { data, error } = await timed("api.memories.list", async () => {
    let query = ctx.supabase
      .from("memories")
      .select("*")
      .neq("status", "deleted")
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);
    if (search) query = query.ilike("content", `%${search}%`);

    return query;
  });
  const listMs = performance.now() - started;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const res = NextResponse.json({ memories: data });
  if (isPerfTimingEnabled()) {
    res.headers.set(
      "Server-Timing",
      appendServerTiming(null, serverTimingMetric("memories-list", listMs))
    );
  }
  return res;
}

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await checkRateLimit(ctx.user.id, "memory_write", 60, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const provider = getMemoryProvider();
  const [memory] = await provider.insert(ctx.supabase, ctx.user.id, [
    {
      content: parsed.data.content,
      type: parsed.data.type,
      category: parsed.data.category ?? null,
      confidence: parsed.data.confidence,
      source: "manual",
      status: "active",
      is_sensitive: isSensitive(parsed.data.content),
      expires_at: parsed.data.expires_at ?? null,
    },
  ]);

  await recordAudit({
    userId: ctx.user.id,
    action: "memory.create",
    entityType: "memory",
    entityId: memory.id,
    metadata: { type: memory.type, source: "manual" },
  });

  return NextResponse.json({ memory }, { status: 201 });
}
