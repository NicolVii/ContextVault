import type { MemoryProvider } from "./provider";
import { SupabaseMemoryProvider } from "./supabase-provider";
import { Mem0MemoryProvider } from "./mem0-provider";

let cached: MemoryProvider | null = null;

/** Read MEM0_API_KEY, trimming whitespace and optional surrounding quotes. */
export function readMem0ApiKey(
  env: Record<string, string | undefined> = process.env
): string | null {
  const raw = env.MEM0_API_KEY;
  if (raw == null) return null;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key.length > 0 ? key : null;
}

export function getMemoryProvider(): MemoryProvider {
  if (cached) return cached;
  const which = process.env.MEMORY_PROVIDER ?? "supabase";
  const apiKey = readMem0ApiKey();
  if (which === "mem0" && apiKey) {
    cached = new Mem0MemoryProvider(apiKey);
  } else {
    cached = new SupabaseMemoryProvider();
  }
  return cached;
}

/** Test helper — clears the cached singleton between cases. */
export function resetMemoryProviderCache(): void {
  cached = null;
}

export * from "./provider";
