import type { RetrievedChunk, RetrievedMemory, UserIdentity } from "@/lib/types";
import type { ChatMessage } from "@/lib/ai/provider";
import { BRAND } from "@/lib/brand";

/** Max characters of persona included in the system prompt. */
export const PERSONA_PROMPT_MAX = 500;

const BASE_SYSTEM_PROMPT = `You are ${BRAND.name}'s assistant. You help the user using their saved personal context.
Guidelines:
- Account profile / USER IDENTITY is authoritative for the user's name and persona. If a name is listed, you know their name — answer with it. Never say you don't have their name when it is listed. Prefer it over conflicting profile memories and over earlier assistant turns that claimed you lacked their name.
- Use USER CONTEXT (saved memories and documents) when it is relevant to the question.
- If you rely on a document, cite it as [filename p.N].
- Never reveal secrets and never invent facts that are not in the account profile or USER CONTEXT.`;

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

export function hasIdentity(identity: UserIdentity): boolean {
  return Boolean(identity.displayName || identity.persona);
}

/** Plain-language identity facts for prompts (no section fences). */
export function formatIdentityFacts(identity: UserIdentity): string[] {
  const lines: string[] = [];
  if (identity.displayName) {
    lines.push(`The user's name is ${identity.displayName}.`);
  }
  if (identity.persona) {
    lines.push(`Persona: ${identity.persona}`);
  }
  return lines;
}

function formatIdentityBlock(identity: UserIdentity): string[] {
  return [
    "----- USER IDENTITY -----",
    ...formatIdentityFacts(identity),
    "----- END USER IDENTITY -----",
  ];
}

/**
 * Prefix the outbound user turn with account identity so the model sees the
 * name adjacent to the question. The persisted chat_messages row stays clean.
 */
export function augmentUserMessageForModel(
  message: string,
  identity: UserIdentity
): string {
  if (!hasIdentity(identity)) return message;
  return [
    "[Account profile for this reply — trust this over earlier turns]",
    ...formatIdentityFacts(identity),
    "",
    message,
  ].join("\n");
}

/**
 * Assemble the provider message list: system prompt, history, then the
 * (possibly identity-augmented) user turn.
 */
export function composeChatMessages(args: {
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  identity: UserIdentity;
}): ChatMessage[] {
  return [
    { role: "system", content: args.systemPrompt },
    ...args.history,
    {
      role: "user",
      content: augmentUserMessageForModel(args.userMessage, args.identity),
    },
  ];
}

/**
 * When the account profile already has a display name, answer name questions
 * from structured identity instead of asking the LLM. Soft prompt injection
 * has proven unreliable across models/history in production.
 */
export function directIdentityAnswer(
  message: string,
  identity: UserIdentity
): string | null {
  const name = identity.displayName?.trim();
  if (!name) return null;

  const text = message.trim();
  if (!text) return null;

  const asksName =
    /\b(?:what(?:['’]?s| is|s)?\s+my\s+name|what(?:['’]?s| is)?\s+the\s+user['’]?s\s+name|who\s+am\s+i|do\s+you\s+(?:know|remember)\s+my\s+name|remind\s+me\s+(?:of\s+)?my\s+name|what\s+name\s+do\s+you\s+have(?:\s+for\s+me)?|have\s+you\s+(?:got|saved)\s+my\s+name)\b/i.test(
      text
    ) || /^(?:my\s+)?name\??$/i.test(text);

  if (!asksName) return null;
  return `Your name is ${name}.`;
}

/**
 * Build the system prompt with identity first (high salience), then guidelines,
 * then USER CONTEXT. Account profile is also mirrored into USER CONTEXT so
 * models that mainly attend to that section still see the name.
 */
export function buildSystemPrompt(
  memories: RetrievedMemory[],
  chunks: RetrievedChunk[],
  identity: UserIdentity = {}
): BuiltContext {
  const lines: string[] = [];

  if (hasIdentity(identity)) {
    lines.push(...formatIdentityBlock(identity), "");
  }

  lines.push(BASE_SYSTEM_PROMPT);

  const includeContext = memories.length > 0 || chunks.length > 0 || hasIdentity(identity);

  if (includeContext) {
    lines.push("\n----- USER CONTEXT (retrieved for this message) -----");

    if (hasIdentity(identity)) {
      lines.push("\nAccount profile:");
      for (const fact of formatIdentityFacts(identity)) {
        lines.push(`  - ${fact}`);
      }
    }

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

  return {
    systemPrompt: lines.join("\n"),
    usedMemories: memories,
    usedChunks: chunks,
    identity,
  };
}
