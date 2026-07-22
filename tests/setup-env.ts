import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

// Load .env.local into process.env for tests (vitest does not do this).
try {
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env.local is optional for unit tests; integration tests assert below.
}

/** True when this Vitest process is running the DB-backed suite. */
export function isIntegrationRun(): boolean {
  // vitest passes the file path as a CLI arg for `pnpm test:integration`.
  const argv = process.argv.join(" ");
  return (
    argv.includes("memory.test.ts") ||
    argv.includes("admin-auth.integration.test.ts") ||
    process.env.CV_INTEGRATION === "1" ||
    // Full `pnpm test` includes integration — detect via env set by package scripts.
    process.env.CV_REQUIRE_SUPABASE === "1"
  );
}

export function assertIntegrationEnv(): void {
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    const hasLocal = existsSync(resolve(process.cwd(), ".env.local"));
    throw new Error(
      [
        "Integration tests require a running local Supabase stack and filled env.",
        hasLocal
          ? `Missing keys: ${missing.join(", ")}. Run \`pnpm env:sync\`.`
          : "No .env.local found. Run `pnpm bootstrap` or `pnpm env:sync`.",
        "Then: `pnpm db:start` (if needed) and re-run `pnpm test:integration` or `pnpm check:full`.",
      ].join("\n"),
    );
  }
}
