export interface ChatModel {
  id: string;
  label: string;
  vendor: string;
}

/** Session / request value meaning “use the user’s default model”. */
export const AUTO_MODEL_ID = "auto" as const;

/** A curated shortlist of models exposed in the Thinking plus menu. */
export const CHAT_MODELS: ChatModel[] = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", vendor: "OpenAI" },
  { id: "openai/gpt-4o", label: "GPT-4o", vendor: "OpenAI" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", vendor: "Anthropic" },
  { id: "google/gemini-flash-1.5", label: "Gemini 1.5 Flash", vendor: "Google" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B", vendor: "Meta" },
];

export function isValidModel(id: string): boolean {
  return id === AUTO_MODEL_ID || CHAT_MODELS.some((m) => m.id === id);
}

export function modelLabel(id: string): string {
  if (id === AUTO_MODEL_ID) return "Auto";
  return CHAT_MODELS.find((m) => m.id === id)?.label ?? id;
}

/** Friendly label for display when Auto resolved to a concrete model. */
export function resolvedModelDisplay(choice: string, resolvedId: string): string {
  if (choice === AUTO_MODEL_ID) {
    const resolved = modelLabel(resolvedId);
    return resolved === resolvedId ? "Auto" : `Auto (${resolved})`;
  }
  return modelLabel(choice);
}
