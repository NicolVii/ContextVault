import type { RetrievedChunk, RetrievedMemory, UserIdentity } from "@/lib/types";

/** Max characters of persona included in the system prompt. */
export const PERSONA_PROMPT_MAX = 500;

const BASE_SYSTEM_PROMPT = `You are Context Vault's assistant. You help the user using their saved personal context.
Guidelines:
- The USER IDENTITY section is the source of truth for the user's name and persona. Prefer it over any conflicting profile memories.
- Use the USER CONTEXT below when it is relevant. It comes from the user's own saved memories and documents.
- If you rely on a document, cite it as [filename p.N].
- Never reveal secrets and never invent context that is not provided.`;

export interface BuiltContext {
  systemPrompt: string;
  usedMemories: RetrievedMemory[];
  usedChunks: RetrievedChunk[];
  identity: UserIdentity;
}

type ProfileIdentityFields = {
  display_name?: string | null;
  persona?: string | null;
};

/**
 * Build an allowlisted UserIdentity from a profiles row (or partial).
 * Omits empty/whitespace fields and caps persona length.
 */
export function toUserIdentity(
  profile: ProfileIdentityFields | null | undefined
): UserIdentity {
  const identity: UserIdentity = {};
  const displayName = profile?.display_name?.trim();
  if (displayName) identity.displayName = displayName;
  const persona = profile?.persona?.trim();
  if (persona) identity.persona = persona.slice(0, PERSONA_PROMPT_MAX);
  return identity;
}

function hasIdentity(identity: UserIdentity): boolean {
  return Boolean(identity.displayName || identity.persona);
}

function formatIdentityBlock(identity: UserIdentity): string[] {
  const lines = ["\n----- USER IDENTITY -----"];
  if (identity.displayName) lines.push(`- Name: ${identity.displayName}`);
  if (identity.persona) lines.push(`- Persona: ${identity.persona}`);
  lines.push("----- END USER IDENTITY -----");
  return lines;
}

/**
 * Build the system prompt with a clearly-separated USER IDENTITY block
 * (account profile) and USER CONTEXT section (retrieved memories / docs).
 */
export function buildSystemPrompt(
  memories: RetrievedMemory[],
  chunks: RetrievedChunk[],
  identity: UserIdentity = {}
): BuiltContext {
  const lines: string[] = [BASE_SYSTEM_PROMPT];

  if (hasIdentity(identity)) {
    lines.push(...formatIdentityBlock(identity));
  }

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
  } else if (!hasIdentity(identity)) {
    lines.push("\n(No saved user context was relevant to this message.)");
  }

  return {
    systemPrompt: lines.join("\n"),
    usedMemories: memories,
    usedChunks: chunks,
    identity,
  };
}
