/**
 * Wrapper around seed.ts that gives a clear error when .env.local is missing.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { ENV_LOCAL, loadEnvLocalIntoProcess } from "./env";

if (!existsSync(ENV_LOCAL)) {
  console.error(
    `.env.local not found. Run \`pnpm env:sync\` (or \`pnpm bootstrap\`) before seeding.`,
  );
  process.exit(1);
}

loadEnvLocalIntoProcess();

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", resolve(process.cwd(), "scripts/seed.ts")],
  {
    stdio: "inherit",
    env: process.env,
  },
);

process.exit(result.status ?? 1);
