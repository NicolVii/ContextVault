import type { ChatProvider } from "@/lib/ai";
import type { ExtractionProvider, RawExtractedCandidate } from "./provider";
import { parseExtractionResponse } from "./schema";

import { toProviderModelId, DEFAULT_MODEL_ID } from "@/lib/inference/models";

const DEFAULT_MODEL = toProviderModelId(
  process.env.EXTRACTION_MODEL ?? DEFAULT_MODEL_ID
);

export const EXTRACTION_SYSTEM_PROMPT = `You extract durable personal memories from a user's chat message for a personal AI memory vault.

Return ONLY valid JSON matching this schema (no markdown, no commentary):
{"memories":[{"content":"string","type":"profile|preference|semantic|episodic|project|temporary","category":"string|null","confidence":0.0-1.0}]}

Rules:
- Extract at most 5 memories. Prefer fewer high-quality facts over many weak ones.
- Only extract durable facts about the user themselves (identity, lasting preferences, projects, standing knowledge, past events).
- Rewrite each memory as a concise, standalone first-person statement (e.g. "I prefer concise answers.").
- DO extract persistent communication preferences and standing instructions for how assistants should treat this user going forward (e.g. "Always be concise", "I prefer bullet points", "From now on use metric units", "Never use jargon with me"). Phrase them as lasting preferences.
- DO extract clear implicit preferences when they are durable ("I'm a night owl", "Coffee keeps me going", "I can't stand meetings before 10").
- DO NOT extract one-time task commands or ephemeral requests ("summarize this", "rewrite the next paragraph", "fix this email now", "translate the text below").
- DO NOT extract questions seeking information, third-party facts about other people, or hypotheticals / counterfactuals ("If I lived in Tokyo...", "Suppose I were a designer...").
- Never extract passwords, API keys, tokens, credit-card numbers, bank details, SSNs, passport/license numbers, or similar secrets. If the message is only secrets, return {"memories":[]}.
- Do not invent facts. If nothing durable is present, return {"memories":[]}.
- Types: profile (who they are), preference (how they like things / lasting communication style), semantic (lasting knowledge), episodic (specific events), project (ongoing work), temporary (short-lived).
- category: a short label like "About me", "Preferences", "Work", "Projects", "Notes", or null.
- confidence: your certainty from 0 to 1.`;

/**
 * LLM-backed extractor. Asks the active ChatProvider for structured JSON and
 * validates the response. Remains provider-agnostic: any ChatProvider that can
 * return text works (OpenRouter today; others later).
 */
export class LlmExtractionProvider implements ExtractionProvider {
  readonly name = "llm";
  private readonly chat: ChatProvider;
  private readonly model: string;

  constructor(chat: ChatProvider, model?: string) {
    this.chat = chat;
    this.model = model
      ? toProviderModelId(model)
      : DEFAULT_MODEL;
  }

  async extract(text: string): Promise<RawExtractedCandidate[]> {
    const trimmed = text.trim();
    if (!trimmed) return [];

    const result = await this.chat.complete(
      this.model,
      [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
      { temperature: 0, json: true }
    );

    const parsed = parseExtractionResponse(result.content);
    if (!parsed.ok) {
      // Surface parse/schema failures so extractCandidates can fall back to
      // heuristics. A valid {"memories":[]} is ok:true with an empty list.
      throw new Error(`Invalid extraction response: ${parsed.error}`);
    }

    return parsed.memories.map((m) => ({
      content: m.content.replace(/\s+/g, " ").trim(),
      type: m.type,
      category: m.category ?? null,
      confidence: m.confidence ?? 0.7,
    }));
  }
}
