import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage } from "@/lib/ai/provider";

export interface ConversationMessage {
  id: string;
  content: string;
  model: string | null;
  created_at: string;
}

export interface ContextLink {
  memoryId?: string;
  documentChunkId?: string;
  relevance: number;
}

/**
 * Conversation persistence port. Implementations may use Supabase internally;
 * callers never import provider SDKs or SQL.
 */
export interface ConversationStore {
  getOrCreateSession(input: {
    userId: string;
    sessionId?: string | null;
    selectionKey: string;
    title: string;
  }): Promise<string>;

  getHistory(sessionId: string, limit: number): Promise<ChatMessage[]>;

  appendUserMessage(input: {
    sessionId: string;
    userId: string;
    content: string;
  }): Promise<void>;

  appendAssistantMessage(input: {
    sessionId: string;
    userId: string;
    content: string;
    model: string;
  }): Promise<ConversationMessage>;

  attachContext(input: {
    messageId: string;
    userId: string;
    links: ContextLink[];
  }): Promise<void>;
}

export function createSupabaseConversationStore(
  client: SupabaseClient
): ConversationStore {
  return {
    async getOrCreateSession({ userId, sessionId, selectionKey, title }) {
      if (sessionId) return sessionId;
      const { data: session, error } = await client
        .from("chat_sessions")
        .insert({
          user_id: userId,
          model: selectionKey,
          title: title.slice(0, 60),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return session.id as string;
    },

    async getHistory(sessionId, limit) {
      const { data: history } = await client
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(limit);

      return ((history ?? []) as ChatMessage[])
        .reverse()
        .map((m) => ({ role: m.role, content: m.content }));
    },

    async appendUserMessage({ sessionId, userId, content }) {
      const { error } = await client.from("chat_messages").insert({
        session_id: sessionId,
        user_id: userId,
        role: "user",
        content,
      });
      if (error) throw new Error(error.message);
    },

    async appendAssistantMessage({ sessionId, userId, content, model }) {
      const { data: assistantMsg, error } = await client
        .from("chat_messages")
        .insert({
          session_id: sessionId,
          user_id: userId,
          role: "assistant",
          content,
          model,
        })
        .select("id, content, model, created_at")
        .single();
      if (error) throw new Error(error.message);
      return assistantMsg as ConversationMessage;
    },

    async attachContext({ messageId, userId, links }) {
      if (links.length === 0) return;
      const rows = links.map((link) => ({
        message_id: messageId,
        user_id: userId,
        memory_id: link.memoryId ?? null,
        document_chunk_id: link.documentChunkId ?? null,
        relevance: link.relevance,
      }));
      const { error } = await client.from("message_context").insert(rows);
      if (error) throw new Error(error.message);
    },
  };
}
