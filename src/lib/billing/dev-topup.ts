/**
 * Dev top-up is for local/demo only.
 * Production must never allow it — no env override.
 */
export function isDevTopupAllowed(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.NODE_ENV === "production") return false;
  return true;
}
