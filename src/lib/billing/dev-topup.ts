import { isCommercialDevTopupAllowed } from "./commercial";

/**
 * Dev top-up is for local commercial demo only.
 * Production must never allow it — no env override.
 * Delegates to commercial mode (demo + non-production).
 */
export function isDevTopupAllowed(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return isCommercialDevTopupAllowed(env);
}
