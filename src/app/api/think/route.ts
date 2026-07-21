import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getMemoryProvider } from "@/lib/memory";
import { isSensitive } from "@/lib/memory/redaction";
import { extractCandidates } from "@/lib/memory/extraction";
import {
  buildSystemPrompt,
  composeChatMessages,
  directIdentityAnswer,
  toUserIdentity,
} from "@/lib/ai/context";
import { getChatProvider, type ChatMessage } from "@/lib/ai";
import {
  isValidModel,
  CHAT_MODELS,
  AUTO_MODEL_ID,
  resolvedModelDisplay,
} from "@/lib/ai/models";
import { displayNameFromUser } from "@/lib/profile";
import { checkRateLimit } from "@/lib/ratelimit";
import { recordAudit } from "@/lib/audit";
import { classifyIntent, stripRememberPrefix } from "@/lib/think/intent";
import { z } from "zod";
import type { RetrievedChunk, RetrievedMemory } from "@/lib/types";

export const dynamic = "force-dynamic";

const MIN_SIMILARITY = 0.05;
const HISTORY_LIMIT = 10;

const thinkRequestSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  sessionId: z.string().uuid().optional().nullable(),
  /** Concrete model id or "auto". */
  model: z.string().min(1).optional(),
});

function responseMeta(opts: {
  modelChoice: string;
  resolvedModel: string;
  memoryRegistered: boolean;
  createdAt?: string;
}) {
  return {
    createdAt: opts.createdAt ?? new Date().toISOString(),
    modelChoice: opts.modelChoice,
    model: opts.resolvedModel,
    modelLabel: resolvedModelDisplay(opts.modelChoice, opts.resolvedModel),
    memoryRegistered: opts.memoryRegistered,
  };
}

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await checkRateLimit(ctx.user.id, "think", 40, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Please slow down." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = thinkRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { supabase, user } = ctx;
  const message = parsed.data.message;
  const intent = classifyIntent(message);

  const modelChoice = parsed.data.model ?? AUTO_MODEL_ID;
  if (!isValidModel(modelChoice)) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }

  let resolvedModel = CHAT_MODELS[0].id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("default_model")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.default_model && isValidModel(profile.default_model) && profile.default_model !== AUTO_MODEL_ID) {
    resolvedModel = profile.default_model;
  }
  if (modelChoice !== AUTO_MODEL_ID) {
    resolvedModel = modelChoice;
  }

  if (intent === "statement") {
    return handleStatement(ctx, message, modelChoice, resolvedModel);
  }

  if (intent === "instruction") {
    const handled = await handleInstruction(ctx, message, modelChoice, resolvedModel);
    if (handled) return handled;
  }

  return handleQuestion(
    ctx,
    message,
    modelChoice,
    resolvedModel,
    parsed.data.sessionId ?? null,
    intent === "instruction" ? "instruction" : "question"
  );
}

async function handleStatement(
  ctx: NonNullable<Awaited<ReturnType<typeof getSessionContext>>>,
  message: string,
  modelChoice: string,
  resolvedModel: string
) {
  const { supabase, user } = ctx;
  const content = stripRememberPrefix(message) || message;
  const provider = getMemoryProvider();
  const [memory] = await provider.insert(supabase, user.id, [
    {
      content,
      type: "episodic",
      category: null,
      confidence: 1,
      source: "manual",
      status: "active",
      is_sensitive: isSensitive(content),
    },
  ]);

  await recordAudit({
    userId: user.id,
    action: "think.remember",
    entityType: "memory",
    entityId: memory.id,
    metadata: { intent: "statement" },
  });

  return NextResponse.json({
    intent: "statement" as const,
    ...responseMeta({
      modelChoice,
      resolvedModel,
      memoryRegistered: true,
      createdAt: memory.created_at,
    }),
  });
}

async function handleInstruction(
  ctx: NonNullable<Awaited<ReturnType<typeof getSessionContext>>>,
  message: string,
  modelChoice: string,
  resolvedModel: string
): Promise<NextResponse | null> {
  const { supabase, user } = ctx;
  const lower = message.trim().toLowerCase();

  // remember … → store as active memory with confirmation
  if (/^((please\s+)?remember)\b/i.test(message.trim())) {
    const content = stripRememberPrefix(message);
    if (!content) return null;
    const provider = getMemoryProvider();
    const [memory] = await provider.insert(supabase, user.id, [
      {
        content,
        type: "semantic",
        category: null,
        confidence: 1,
        source: "manual",
        status: "active",
        is_sensitive: isSensitive(content),
      },
    ]);
    await recordAudit({
      userId: user.id,
      action: "think.remember",
      entityType: "memory",
      entityId: memory.id,
      metadata: { intent: "instruction" },
    });
    return NextResponse.json({
      intent: "instruction" as const,
      confirmation: "Got it.",
      ...responseMeta({
        modelChoice,
        resolvedModel,
        memoryRegistered: true,
        createdAt: memory.created_at,
      }),
    });
  }

  // forget / delete … → archive matching memories by content search
  if (/^(forget|delete|remove|don't remember|do not remember)\b/i.test(message.trim())) {
    const topic = message
      .trim()
      .replace(/^(please\s+)?(forget|delete|remove|don't remember|do not remember)\s+(about\s+|that\s+|my\s+)?/i, "")
      .trim();
    if (topic.length < 2) {
      return NextResponse.json({
        intent: "instruction" as const,
        confirmation: "Tell me what to forget.",
        ...responseMeta({ modelChoice, resolvedModel, memoryRegistered: false }),
      });
    }
    const { data } = await supabase
      .from("memories")
      .select("id, content")
      .eq("status", "active")
      .ilike("content", `%${topic}%`)
      .limit(5);
    const matches = data ?? [];
    if (matches.length === 0) {
      return NextResponse.json({
        intent: "instruction" as const,
        confirmation: "I couldn't find anything matching that.",
        ...responseMeta({ modelChoice, resolvedModel, memoryRegistered: false }),
      });
    }
    const ids = matches.map((m) => m.id);
    await supabase.from("memories").update({ status: "archived" }).in("id", ids);
    await recordAudit({
      userId: user.id,
      action: "think.forget",
      entityType: "memory",
      metadata: { count: ids.length, topic },
    });
    return NextResponse.json({
      intent: "instruction" as const,
      confirmation:
        matches.length === 1
          ? "Forgotten."
          : `Archived ${matches.length} related memories.`,
      ...responseMeta({ modelChoice, resolvedModel, memoryRegistered: false }),
    });
  }

  // show / list memories → nudge to Vault
  if (/^(show|list|open)\b/i.test(lower)) {
    return NextResponse.json({
      intent: "instruction" as const,
      confirmation: "Open the Vault to browse your memories and files.",
      action: { type: "open_vault" as const },
      ...responseMeta({ modelChoice, resolvedModel, memoryRegistered: false }),
    });
  }

  return null;
}

async function handleQuestion(
  ctx: NonNullable<Awaited<ReturnType<typeof getSessionContext>>>,
  message: string,
  modelChoice: string,
  model: string,
  existingSessionId: string | null,
  intent: "question" | "instruction"
) {
  const { supabase, user } = ctx;

  let sessionId = existingSessionId;
  if (!sessionId) {
    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, model, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    sessionId = session.id;
  }

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, persona")
    .eq("id", user.id)
    .maybeSingle();
  const identity = toUserIdentity({
    display_name: profile?.display_name?.trim() || displayNameFromUser(user),
    persona: profile?.persona ?? null,
  });

  const { systemPrompt } = buildSystemPrompt(usedMemories, usedChunks, identity);

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const historyMsgs: ChatMessage[] = ((history ?? []) as ChatMessage[])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    user_id: user.id,
    role: "user",
    content: message,
  });

  let result: { content: string; model: string; mocked?: boolean };
  let identityDirect = false;

  if (intent === "instruction") {
    // Short confirmation-style reply for unhandled instructions.
    try {
      result = await getChatProvider().complete(
        model,
        composeChatMessages({
          systemPrompt:
            systemPrompt +
            "\n\nThe user gave an instruction. Reply with a brief confirmation of what you did or will do. One or two sentences maximum. Do not lecture.",
          history: historyMsgs,
          userMessage: message,
          identity,
        })
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Model request failed" },
        { status: 502 }
      );
    }
  } else {
    const direct = directIdentityAnswer(message, identity);
    if (direct) {
      identityDirect = true;
      result = { content: direct, model, mocked: false };
    } else {
      try {
        result = await getChatProvider().complete(
          model,
          composeChatMessages({
            systemPrompt,
            history: historyMsgs,
            userMessage: message,
            identity,
          })
        );
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Model request failed" },
          { status: 502 }
        );
      }
    }
  }

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
          source_detail: `think:${sessionId}`,
          status: "proposed" as const,
          is_sensitive: c.is_sensitive,
        }))
      );
      proposedCount = fresh.length;
    }
  }

  await recordAudit({
    userId: user.id,
    action: "think.message",
    entityType: "chat_session",
    entityId: sessionId,
    metadata: {
      intent,
      model: result.model,
      memories_used: usedMemories.length,
      chunks_used: usedChunks.length,
      proposed: proposedCount,
      identity_direct: identityDirect,
    },
  });

  return NextResponse.json({
    intent,
    sessionId,
    message: assistantMsg,
    confirmation: intent === "instruction" ? assistantMsg.content : undefined,
    proposedCount,
    mocked: result.mocked,
    ...responseMeta({
      modelChoice,
      resolvedModel: result.model,
      memoryRegistered: proposedCount > 0,
      createdAt: assistantMsg.created_at,
    }),
  });
}
