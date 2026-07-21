export const BYOK_PROVIDERS = [
  "openrouter",
  "openai",
  "anthropic",
  "google",
  "groq",
] as const;

export type ByokProvider = (typeof BYOK_PROVIDERS)[number];
