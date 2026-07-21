/**
 * Central product identity. Swap `name` here when the final brand is locked —
 * do not hardcode the product name across the UI.
 */
export const BRAND = {
  name: "Context Vault",
  /** Short label for compact chrome (e.g. Vault button). */
  vaultLabel: "Vault",
  tagline: "Your external cortex.",
  description:
    "A calm second brain for capturing thoughts, remembering what matters, and asking questions — without thinking about AI plumbing.",
  composerPlaceholder: "What's on your mind?",
} as const;

export type Brand = typeof BRAND;
