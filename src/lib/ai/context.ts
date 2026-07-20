import type { RetrievedChunk, RetrievedMemory } from "@/lib/types";

const BASE_SYSTEM_PROMPT = `You are Context Vault's assistant. You help the user using their saved personal context.
Guidelines:
- Use the USER CONTEXT below when it is relevant. It comes from the user's own saved memories and documents.
- If you rely on a document, cite it as [filename p.N].
- Never reveal secrets and never invent context that is not provided.`;

export interface BuiltContext {
  systemPrompt: string;
  usedMemories: RetrievedMemory[];
  usedChunks: RetrievedChunk[];
}

/**
 * Build the system prompt with a clearly-separated USER CONTEXT section that
 * contains only the most relevant memories and document snippets.
 */
export function buildSystemPrompt(
  memories: RetrievedMemory[],
  chunks: RetrievedChunk[]
): BuiltContext {
  const lines: string[] = [BASE_SYSTEM_PROMPT];

  if (memories.length > 0 || chunks.length > 0) {
    lines.push("\n----- USER CONTEXT (retrieved for this message) -----");

    if (memories.length > 0) {
      lines.push("\nMemories:");
      memories.forEach((m, i) => {
        lines.push(`  ${i + 1}. (${m.type}) ${m.content}`);
      });
    }

    if (chunks.length > 0) {
      lines.push("\nDocument excerpts:");
      chunks.forEach((c) => {
        const cite = c.page_number ? `${c.filename} p.${c.page_number}` : c.filename;
        lines.push(`  - [${cite}] ${c.content.slice(0, 500)}`);
      });
    }

    lines.push("\n----- END USER CONTEXT -----");
  } else {
    lines.push("\n(No saved user context was relevant to this message.)");
  }

  return { systemPrompt: lines.join("\n"), usedMemories: memories, usedChunks: chunks };
}
