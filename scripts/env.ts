/**
 * Shared helpers for local env files used by bootstrap / health / env:sync / seed.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

export const ROOT = resolve(process.cwd());
export const ENV_LOCAL = resolve(ROOT, ".env.local");
export const ENV_EXAMPLE = resolve(ROOT, ".env.example");

export const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type EnvMap = Record<string, string>;

export function parseEnvFile(path: string): EnvMap {
  const out: EnvMap = {};
  if (!existsSync(path)) return out;
  const content = readFileSync(path, "utf-8");
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
    out[key] = value;
  }
  return out;
}

export function loadEnvLocalIntoProcess(): void {
  const map = parseEnvFile(ENV_LOCAL);
  for (const [key, value] of Object.entries(map)) {
    if (!(key in process.env)) process.env[key] = value;
  }
}

/** Update or append keys in an .env-style file without wiping comments/other keys. */
export function upsertEnvKeys(path: string, updates: EnvMap): void {
  let content = existsSync(path) ? readFileSync(path, "utf-8") : "";
  const lines = content.length ? content.split("\n") : [];
  const seen = new Set<string>();

  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }

  // Ensure trailing newline
  const body = next.join("\n").replace(/\n*$/, "\n");
  writeFileSync(path, body, "utf-8");
}

export function ensureEnvLocalFromExample(): boolean {
  if (existsSync(ENV_LOCAL)) return false;
  if (!existsSync(ENV_EXAMPLE)) {
    throw new Error(`.env.example not found at ${ENV_EXAMPLE}`);
  }
  copyFileSync(ENV_EXAMPLE, ENV_LOCAL);
  return true;
}

export function missingRequiredKeys(env: EnvMap = parseEnvFile(ENV_LOCAL)): string[] {
  return REQUIRED_KEYS.filter((k) => !env[k]?.trim());
}

/** Parse `supabase status -o env` output into a map. */
export function readSupabaseStatusEnv(): EnvMap | null {
  try {
    const out = execFileSync("supabase", ["status", "-o", "env"], {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const map: EnvMap = {};
    for (const line of out.split("\n")) {
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
      map[key] = value;
    }
    return map;
  } catch {
    return null;
  }
}

/**
 * Map Supabase CLI env keys → Next.js local env keys.
 * Prefer API_URL / ANON_KEY / SERVICE_ROLE_KEY from `supabase status -o env`.
 */
export function supabaseKeysFromStatus(status: EnvMap): EnvMap {
  const updates: EnvMap = {};
  const url = status.API_URL ?? status.NEXT_PUBLIC_SUPABASE_URL;
  const anon = status.ANON_KEY ?? status.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service =
    status.SERVICE_ROLE_KEY ?? status.SUPABASE_SERVICE_ROLE_KEY;

  if (url) updates.NEXT_PUBLIC_SUPABASE_URL = url;
  if (anon) updates.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;
  if (service) updates.SUPABASE_SERVICE_ROLE_KEY = service;
  return updates;
}

export function commandExists(bin: string): boolean {
  try {
    execFileSync("sh", ["-c", `command -v ${bin}`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function run(
  cmd: string,
  args: string[],
  opts: { inherit?: boolean } = {},
): void {
  execFileSync(cmd, args, {
    cwd: ROOT,
    stdio: opts.inherit === false ? "pipe" : "inherit",
  });
}

export function dockerReachable(): boolean {
  try {
    execFileSync("docker", ["info"], {
      stdio: "ignore",
      timeout: 10000,
    });
    return true;
  } catch {
    return false;
  }
}

export async function supabaseApiReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    // Fallback: any response from the API root means the stack is up.
    try {
      const res = await fetch(url.replace(/\/$/, "") + "/", {
        signal: AbortSignal.timeout(5000),
      });
      return res.status > 0;
    } catch {
      return false;
    }
  }
}
