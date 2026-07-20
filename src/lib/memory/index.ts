import type { MemoryProvider } from "./provider";
import { SupabaseMemoryProvider } from "./supabase-provider";
import { Mem0MemoryProvider } from "./mem0-provider";

let cached: MemoryProvider | null = null;

export function getMemoryProvider(): MemoryProvider {
  if (cached) return cached;
  const which = process.env.MEMORY_PROVIDER ?? "supabase";
  if (which === "mem0" && process.env.MEM0_API_KEY) {
    cached = new Mem0MemoryProvider(process.env.MEM0_API_KEY);
  } else {
    cached = new SupabaseMemoryProvider();
  }
  return cached;
}

export * from "./provider";
