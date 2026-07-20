import type { MemoryType } from "@/lib/types";
import type { ExtractionProvider, RawExtractedCandidate } from "./provider";

interface Rule {
  re: RegExp;
  type: MemoryType;
  category: string;
  confidence: number;
}

// Ordered rules: the first match wins for a given sentence.
const RULES: Rule[] = [
  { re: /\b(i (really )?(prefer|like|love|enjoy|favou?r|hate|dislike|can'?t stand))\b/i, type: "preference", category: "Preferences", confidence: 0.7 },
  { re: /\b(my name is|i am called|call me|i'?m [A-Z])/i, type: "profile", category: "About me", confidence: 0.8 },
  { re: /\b(i live in|i'?m based in|i'?m from|i was born in)\b/i, type: "profile", category: "About me", confidence: 0.8 },
  { re: /\b(i work (as|at|for)|my job|my role is|i'?m a[n]? )\b/i, type: "profile", category: "Work", confidence: 0.7 },
  { re: /\b(i'?m (working|building) on|my project|we'?re building)\b/i, type: "project", category: "Projects", confidence: 0.7 },
  { re: /\b(remember that|note that|for future reference|keep in mind)\b/i, type: "semantic", category: "Notes", confidence: 0.6 },
  { re: /\b(i use|i rely on|my setup|my stack is|i code in|i write)\b/i, type: "preference", category: "Tools", confidence: 0.6 },
];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && s.length <= 400);
}

/**
 * Offline / fallback extractor. Deterministic regex heuristics that keep the
 * app demoable without an LLM. Used when no chat API key is configured, and
 * as a per-request fallback if the LLM extractor fails.
 */
export class HeuristicExtractionProvider implements ExtractionProvider {
  readonly name = "heuristic";

  async extract(text: string): Promise<RawExtractedCandidate[]> {
    const candidates: RawExtractedCandidate[] = [];
    const seen = new Set<string>();

    for (const sentence of splitSentences(text)) {
      // Only consider first-person statements — these are what we'd remember.
      if (!/\bi\b|\bmy\b|\bme\b/i.test(sentence)) continue;

      const rule = RULES.find((r) => r.re.test(sentence));
      if (!rule) continue;

      const normalized = sentence.replace(/\s+/g, " ").trim();
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        content: normalized,
        type: rule.type,
        category: rule.category,
        confidence: rule.confidence,
      });
    }

    return candidates.slice(0, 5);
  }
}
