/**
 * One-command local bootstrap:
 *   pnpm install → env → Supabase up → db reset + seed
 *
 * Usage: pnpm setup
 *
 * Does not start Docker itself on Cursor Cloud — start dockerd first
 * (see AGENTS.md). On a normal laptop, start Docker Desktop / the daemon
 * before running this script.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  ROOT,
  dockerReachable,
  ensureEnvLocalFromExample,
  missingRequiredKeys,
  parseEnvFile,
  readSupabaseStatusEnv,
  run,
  supabaseKeysFromStatus,
  upsertEnvKeys,
} from "./env";

function syncEnvFromStatusOrExample(): void {
  ensureEnvLocalFromExample();
  const status = readSupabaseStatusEnv();
  if (status) {
    const keys = supabaseKeysFromStatus(status);
    if (Object.keys(keys).length) upsertEnvKeys(resolve(ROOT, ".env.local"), keys);
  }
  const missing = missingRequiredKeys(parseEnvFile(resolve(ROOT, ".env.local")));
  if (missing.length) {
    throw new Error(
      `Missing required keys in .env.local: ${missing.join(", ")}. ` +
        "Ensure Supabase is running and re-run, or copy the local demo JWTs from .env.example.",
    );
  }
}

function main() {
  console.log("==> Installing dependencies");
  run("pnpm", ["install"]);

  if (!dockerReachable()) {
    throw new Error(
      "Docker is not reachable. Start Docker Desktop (or on Cursor Cloud: " +
        "`sudo dockerd > /tmp/dockerd.log 2>&1 &; sleep 8; sudo chmod 666 /var/run/docker.sock`) " +
        "then re-run `pnpm setup`.",
    );
  }

  console.log("==> Starting Supabase");
  try {
    run("supabase", ["start"]);
  } catch {
    // `supabase start` exits non-zero if already running in some versions;
    // verify via status instead.
    if (!readSupabaseStatusEnv()) {
      throw new Error("`supabase start` failed and `supabase status` is unavailable.");
    }
    console.log("Supabase already running.");
  }

  console.log("==> Syncing .env.local");
  syncEnvFromStatusOrExample();

  console.log("==> Resetting database and seeding demo data");
  // Use the package script so db:reset stays the single source of truth.
  run("pnpm", ["db:reset"]);

  if (!existsSync(resolve(ROOT, ".env.local"))) {
    throw new Error(".env.local missing after setup");
  }

  console.log(`
Setup complete.

  Demo login:  demo@contextvault.local / demo-password-123
  App:         pnpm dev   → http://localhost:3000
  Health:      pnpm doctor
  Fast checks: pnpm check
  Full checks: pnpm check:full   (requires Supabase)
`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
