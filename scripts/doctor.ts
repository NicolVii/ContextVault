/**
 * Validate the local development environment.
 *
 * Usage: pnpm doctor
 */
import { existsSync } from "node:fs";
import {
  ENV_LOCAL,
  REQUIRED_KEYS,
  commandExists,
  dockerReachable,
  missingRequiredKeys,
  parseEnvFile,
  supabaseApiReachable,
} from "./env";

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    name: "Node.js 20+",
    ok: nodeMajor >= 20,
    detail: `v${process.versions.node}`,
  });

  checks.push({
    name: "pnpm",
    ok: commandExists("pnpm"),
    detail: commandExists("pnpm") ? "found on PATH" : "not found — install pnpm",
  });

  checks.push({
    name: "Docker",
    ok: commandExists("docker") && dockerReachable(),
    detail: !commandExists("docker")
      ? "docker not on PATH"
      : dockerReachable()
        ? "daemon reachable"
        : "daemon not reachable — start Docker (or `sudo dockerd` on Cursor Cloud)",
  });

  checks.push({
    name: "Supabase CLI",
    ok: commandExists("supabase"),
    detail: commandExists("supabase") ? "found on PATH" : "not found — install Supabase CLI",
  });

  const hasEnv = existsSync(ENV_LOCAL);
  const env = hasEnv ? parseEnvFile(ENV_LOCAL) : {};
  const missing = missingRequiredKeys(env);
  checks.push({
    name: ".env.local",
    ok: hasEnv && missing.length === 0,
    detail: !hasEnv
      ? "missing — run `pnpm env:sync`"
      : missing.length
        ? `missing keys: ${missing.join(", ")} — run \`pnpm env:sync\``
        : `required keys present (${REQUIRED_KEYS.join(", ")})`,
  });

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let apiOk = false;
  let apiDetail = "skipped (no NEXT_PUBLIC_SUPABASE_URL)";
  if (url) {
    apiOk = await supabaseApiReachable(url);
    apiDetail = apiOk
      ? `reachable at ${url}`
      : `not reachable at ${url} — run \`pnpm db:start\``;
  }
  checks.push({
    name: "Supabase API",
    ok: apiOk,
    detail: apiDetail,
  });

  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "ok" : "FAIL";
    console.log(`[${mark}] ${c.name}: ${c.detail}`);
    if (!c.ok) failed += 1;
  }

  if (failed) {
    console.error(`\ndoctor: ${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\ndoctor: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
