/**
 * Ensure .env.local exists and fill local Supabase keys from `supabase status`
 * when the stack is running. Never overwrites non-empty unrelated secrets.
 *
 * Usage: pnpm env:sync
 */
import {
  ENV_LOCAL,
  ensureEnvLocalFromExample,
  missingRequiredKeys,
  parseEnvFile,
  readSupabaseStatusEnv,
  supabaseKeysFromStatus,
  upsertEnvKeys,
} from "./env";

function main() {
  const created = ensureEnvLocalFromExample();
  if (created) {
    console.log(`Created ${ENV_LOCAL} from .env.example`);
  }

  const status = readSupabaseStatusEnv();

  if (status) {
    const fromStatus = supabaseKeysFromStatus(status);
    // Always refresh the three local Supabase keys from a live stack so a
    // stale .env.local cannot silently break auth after a reset.
    if (Object.keys(fromStatus).length > 0) {
      upsertEnvKeys(ENV_LOCAL, fromStatus);
      console.log("Synced NEXT_PUBLIC_SUPABASE_* and SUPABASE_SERVICE_ROLE_KEY from `supabase status`.");
    } else {
      console.warn("supabase status returned no API/ANON/SERVICE keys; left .env.local unchanged for those.");
    }
  } else {
    console.log(
      "Supabase is not running (or `supabase status` failed). Kept existing .env.local values.",
    );
    console.log("Start the stack with `pnpm db:start`, then re-run `pnpm env:sync` to refresh keys.");
  }

  const missing = missingRequiredKeys(parseEnvFile(ENV_LOCAL));
  if (missing.length) {
    console.error(`\nMissing required keys in .env.local: ${missing.join(", ")}`);
    console.error("Fill them from `supabase status` or use the local demo JWTs in .env.example.");
    process.exit(1);
  }

  console.log(".env.local is ready.");
}

main();
