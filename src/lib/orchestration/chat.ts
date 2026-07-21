import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { getMemoryProvider } from "@/lib/memory";
import { extractCandidates } from "@/lib/memory/extraction";
import {
  buildSystemPrompt,
  composeChatMessages,
  directIdentityAnswer,
  toUserIdentity,
} from "@/lib/ai/context";
import { displayNameFromUser } from "@/lib/profile";
import { recordAudit } from "@/lib/audit";
import type { RetrievedChunk, RetrievedMemory, UserIdentity } from "@/lib/types";
import {
  createSupabaseConversationStore,
  type ConversationStore,
} from "@/lib/conversation/store";
import {
  createSupabaseDocumentRetriever,
  type DocumentRetriever,
} from "@/lib/documents/retrieve";
import {
  runInference,
  parseSelection,
  selectionToStorageKey,
  resolveModelProfile,
  DEFAULT_MODEL_ID,
  type SelectionPolicy,
  type RouteReasonCode,
} from "@/lib/inference";

const MIN_SIMILARITY = 0.05;
const HISTORY_LIMIT = 10;

export interface ChatOrchestratorInput {
  user: User;
  supabase: SupabaseClient;
  message: string;
  /** Preset, auto, cortaix model id, or legacy provider id. */
  selectionRaw: string;
  sessionId?: string | null;
  conversation?: ConversationStore;
  documents?: DocumentRetriever;
}

export interface ChatOrchestratorResult {
  sessionId: string;
  message: {
    id: string;
    content: string;
    model: string | null;
    created_at: string;
  };
  usedMemories: RetrievedMemory[];
  usedChunks: RetrievedChunk[];
  usedIdentity: UserIdentity;
  identityDirectAnswer: boolean;
  proposedCount: number;
  mocked: boolean;
  resolved?: {
    modelId: string;
    provider: string;
    providerModelId: string;
    reasonCode: RouteReasonCode;
  };
  selection: SelectionPolicy;
}

/**
 * Context Orchestrator — product application service.
 * Assembles identity + memories + documents + history, then asks the
 * Inference Router for a completion. Never imports provider SDKs.
 */
export async function runChatOrchestrator(
  input: ChatOrchestratorInput
): Promise<ChatOrchestratorResult> {
  const { user, supabase, message } = input;
  const selection = parseSelection(input.selectionRaw);
  const selectionKey = selectionToStorageKey(selection);
  const conversation =
    input.conversation ?? createSupabaseConversationStore(supabase);
  const documents =
    input.documents ?? createSupabaseDocumentRetriever(supabase);

  const sessionId = await conversation.getOrCreateSession({
    userId: user.id,
    sessionId: input.sessionId,
    selectionKey,
    title: message,
  });

  const provider = getMemoryProvider();
  const retrieved = await provider.retrieve(supabase, user.id, message, {
    limit: 8,
  });
  const semantic = retrieved.filter((m) => m.similarity >= MIN_SIMILARITY);

  const { data: profileMems } = await supabase
    .from("memories")
    .select(
      "id, content, category, type, source, source_detail, confidence, created_at"
    )
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

  const usedChunks = await documents.retrieve(user.id, message, {
    limit: 3,
    minSimilarity: MIN_SIMILARITY,
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, persona")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("chat profile identity load failed", profileError.message);
  }
  const identity = toUserIdentity({
    display_name: profile?.display_name?.trim() || displayNameFromUser(user),
    persona: profile?.persona ?? null,
  });

  const { systemPrompt } = buildSystemPrompt(usedMemories, usedChunks, identity);
  const historyMsgs = await conversation.getHistory(sessionId, HISTORY_LIMIT);

  await conversation.appendUserMessage({
    sessionId,
    userId: user.id,
    content: message,
  });

  let content: string;
  let displayModel: string;
  let mocked = false;
  let identityDirect = false;
  let resolved: ChatOrchestratorResult["resolved"];

  const direct = directIdentityAnswer(message, identity);
  if (direct) {
    identityDirect = true;
    content = direct;
    const profileModel =
      selection.type === "model"
        ? resolveModelProfile(selection.modelId)?.id ?? DEFAULT_MODEL_ID
        : DEFAULT_MODEL_ID;
    displayModel = profileModel;
  } else {
    const composed = composeChatMessages({
      systemPrompt,
      history: historyMsgs,
      userMessage: message,
      identity,
    });
    const contextChars =
      systemPrompt.length +
      historyMsgs.reduce((n, m) => n + m.content.length, 0) +
      message.length;

    const requestId = crypto.randomUUID();
    const result = await runInference({
      requestId,
      tenantId: user.id,
      userId: user.id,
      purpose: "chat",
      input: {
        messages: composed,
        contextChars,
        hasVisionAttachment: false,
      },
      selection,
      billingMode: "platform",
    });

    content = result.output.message;
    displayModel = result.meta.mocked
      ? `${result.resolved.modelId} (mock)`
      : result.resolved.modelId;
    mocked = result.meta.mocked;
    resolved = result.resolved;
  }

  const assistantMsg = await conversation.appendAssistantMessage({
    sessionId,
    userId: user.id,
    content,
    model: displayModel,
  });

  await conversation.attachContext({
    messageId: assistantMsg.id,
    userId: user.id,
    links: [
      ...usedMemories.map((m) => ({
        memoryId: m.id,
        relevance: m.similarity,
      })),
      ...usedChunks.map((c) => ({
        documentChunkId: c.id,
        relevance: c.similarity,
      })),
    ],
  });

  const candidates = await extractCandidates(message);
  let proposedCount = 0;
  if (candidates.length > 0) {
    const { data: existing } = await supabase
      .from("memories")
      .select("content")
      .neq("status", "deleted");
    const existingSet = new Set(
      ((existing ?? []) as { content: string }[]).map((e) =>
        e.content.toLowerCase()
      )
    );
    const fresh = candidates.filter(
      (c) => !existingSet.has(c.content.toLowerCase())
    );
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
      model: displayModel,
      selection: selectionKey,
      reason_code: resolved?.reasonCode ?? (identityDirect ? "identity_direct" : null),
      memories_used: usedMemories.length,
      chunks_used: usedChunks.length,
      identity_used: Boolean(identity.displayName || identity.persona),
      identity_direct: identityDirect,
      proposed: proposedCount,
    },
  });

  return {
    sessionId,
    message: assistantMsg,
    usedMemories,
    usedChunks,
    usedIdentity: identity,
    identityDirectAnswer: identityDirect,
    proposedCount,
    mocked,
    resolved,
    selection,
  };
}
