export type ThinkIntent = "statement" | "question" | "instruction";

const QUESTION_LEAD =
  /^(who|what|when|where|why|how|which|whose|whom|is|are|am|was|were|do|does|did|can|could|would|will|should|may|might|shall|have|has|had)\b/i;

const INSTRUCTION_LEAD =
  /^(remember|forget|delete|remove|pin|unpin|archive|restore|show|list|open|add|update|set|change|clear|export|call me|my name is|don't remember|do not remember)\b/i;

/**
 * Lightweight heuristic classifier for Thinking composer submissions.
 * Prefers not generating a full conversational reply for plain captures.
 */
export function classifyIntent(raw: string): ThinkIntent {
  const text = raw.trim();
  if (!text) return "statement";

  if (/\?\s*$/.test(text) || QUESTION_LEAD.test(text)) {
    return "question";
  }

  if (INSTRUCTION_LEAD.test(text)) {
    return "instruction";
  }

  return "statement";
}

/** Strip a leading "remember that/to/…" for statement-style storage. */
export function stripRememberPrefix(raw: string): string {
  return raw
    .trim()
    .replace(/^(please\s+)?remember(\s+(that|to|about))?\s+/i, "")
    .trim();
}
