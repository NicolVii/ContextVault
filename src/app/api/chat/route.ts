import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getMemoryProvider } from "@/lib/memory";
import { extractCandidates } from "@/lib/memory/extraction";
import { buildSystemPrompt } from "@/lib/ai/context";
import { getChatProvider, type ChatMessage } from "@/lib/ai";
import { isValidModel } from "@/lib/ai/models";
import { chatRequestSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { recordAudit } from "@/lib/audit";
import type { RetrievedChunk, RetrievedMemory } from "@/lib/types";

const MIN_SIMILARITY = 0.05;
const HISTORY_LIMIT = 10;

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await checkRateLimit(ctx.user.id, "chat", 30, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Please slow down." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { message, model } = parsed.data;
  if (!isValidModel(model)) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }

  const { supabase, user } = ctx;

  // 1. Resolve or create the chat session (RLS scopes this to the user).
  let sessionId = parsed.data.sessionId ?? null;
  if (!sessionId) {
    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, model, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    sessionId = session.id;
  }

  // 2. Retrieve context for this message. Profile memories describe the user's
  // core identity and are always relevant, so they are injected on every
  // request. Other types are added by semantic similarity.
  const provider = getMemoryProvider();
  const retrieved = await provider.retrieve(supabase, user.id, message, { limit: 8 });
  const semantic = retrieved.filter((m) => m.similarity >= MIN_SIMILARITY);

  const { data: profileMems } = await supabase
    .from("memories")
    .select("id, content, category, type, source, source_detail, confidence, created_at")
    .eq("status", "active")
    .eq("type", "profile")
    .order("created_at", { ascending: true })
    .limit(10);

  const byId = new Map<string, RetrievedMemory>();
  for (const m of (profileMems ?? []) as Omit<RetrievedMemory, "similarity">[]) {
    byId.set(m.id, { ...m, similarity: 1 });
  }
  for (const m of semantic) if (!byId.has(m.id)) byId.set(m.id, m);
  const usedMemories = [...byId.values()];

  let usedChunks: RetrievedChunk[] = [];
  const [embedding] = await (
    await import("@/lib/embeddings")
  ).getEmbeddingProvider().embed([message]);
  const { data: chunkData } = await supabase.rpc("match_document_chunks", {
    query_embedding: `[${embedding.join(",")}]`,
    match_count: 3,
  });
  usedChunks = ((chunkData ?? []) as RetrievedChunk[]).filter(
    (c) => c.similarity >= MIN_SIMILARITY
  );

  // 3. Build the system prompt with a separated USER CONTEXT section.
  const { systemPrompt } = buildSystemPrompt(usedMemories, usedChunks);

  // 4. Load recent history for conversational continuity.
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const historyMsgs: ChatMessage[] = ((history ?? []) as ChatMessage[])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  // 5. Persist the user's message.
  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    user_id: user.id,
    role: "user",
    content: message,
  });

  // 6. Call the model through the active chat provider (OpenRouter or mock).
  let result;
  try {
    result = await getChatProvider().complete(model, [
      { role: "system", content: systemPrompt },
      ...historyMsgs,
      { role: "user", content: message },
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Model request failed" },
      { status: 502 }
    );
  }

  // 7. Persist the assistant message and its context provenance.
  const { data: assistantMsg, error: amErr } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: "assistant",
      content: result.content,
      model: result.model,
    })
    .select("id, content, model, created_at")
    .single();
  if (amErr) return NextResponse.json({ error: amErr.message }, { status: 500 });

  const contextRows = [
    ...usedMemories.map((m) => ({
      message_id: assistantMsg.id,
      user_id: user.id,
      memory_id: m.id,
      relevance: m.similarity,
    })),
    ...usedChunks.map((c) => ({
      message_id: assistantMsg.id,
      user_id: user.id,
      document_chunk_id: c.id,
      relevance: c.similarity,
    })),
  ];
  if (contextRows.length > 0) {
    await supabase.from("message_context").insert(contextRows);
  }

  // 8. Extract candidate memories → review queue (never auto-active).
  // Uses the ExtractionProvider (LLM when available, heuristics offline).
  const candidates = await extractCandidates(message);
  let proposedCount = 0;
  if (candidates.length > 0) {
    const { data: existing } = await supabase
      .from("memories")
      .select("content")
      .neq("status", "deleted");
    const existingSet = new Set(
      ((existing ?? []) as { content: string }[]).map((e) => e.content.toLowerCase())
    );
    const fresh = candidates.filter((c) => !existingSet.has(c.content.toLowerCase()));
    if (fresh.length > 0) {
      await provider.insert(
        supabase,
        user.id,
        fresh.map((c) => ({
          content: c.content,
          type: c.type,
          category: c.category,
          confidence: c.confidence,
          source: "chat_extraction" as const,
          source_detail: `chat:${sessionId}`,
          status: "proposed" as const,
          is_sensitive: c.is_sensitive,
        }))
      );
      proposedCount = fresh.length;
    }
  }

  await recordAudit({
    userId: user.id,
    action: "chat.message",
    entityType: "chat_session",
    entityId: sessionId,
    metadata: {
      model: result.model,
      memories_used: usedMemories.length,
      chunks_used: usedChunks.length,
      proposed: proposedCount,
    },
  });

  return NextResponse.json({
    sessionId,
    message: assistantMsg,
    usedMemories,
    usedChunks,
    proposedCount,
    mocked: result.mocked,
  });
}
