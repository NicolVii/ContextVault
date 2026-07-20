export interface ChatModel {
  id: string;
  label: string;
  vendor: string;
}

/** A curated shortlist of OpenRouter models exposed in the chat picker. */
export const CHAT_MODELS: ChatModel[] = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", vendor: "OpenAI" },
  { id: "openai/gpt-4o", label: "GPT-4o", vendor: "OpenAI" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", vendor: "Anthropic" },
  { id: "google/gemini-flash-1.5", label: "Gemini 1.5 Flash", vendor: "Google" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B", vendor: "Meta" },
];

export function isValidModel(id: string): boolean {
  return CHAT_MODELS.some((m) => m.id === id);
}
