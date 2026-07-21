import type { MemorySource, MemoryStatus, MemoryType } from "@/lib/types";

const MEM0_ID_PREFIX = "mem0:";

/** Context Vault metadata stored on each Mem0 memory for round-tripping. */
export interface CvMem0Metadata {
  cv_memory_id: string;
  type: MemoryType;
  source: MemorySource;
  status: MemoryStatus;
  category?: string | null;
  source_detail?: string | null;
  confidence?: number;
  is_sensitive?: boolean;
}

export interface Mem0MetadataInput {
  content: string;
  type: MemoryType;
  source: MemorySource;
  status?: MemoryStatus;
  category?: string | null;
  source_detail?: string | null;
  confidence?: number;
  is_sensitive?: boolean;
  expires_at?: string | null;
}

export function buildMem0Metadata(
  memoryId: string,
  memory: Mem0MetadataInput
): CvMem0Metadata {
  return {
    cv_memory_id: memoryId,
    type: memory.type,
    source: memory.source,
    status: memory.status ?? "active",
    category: memory.category ?? null,
    source_detail: memory.source_detail ?? null,
    confidence: memory.confidence ?? 1,
    is_sensitive: memory.is_sensitive ?? false,
  };
}

/** Append or set the Mem0 memory id in `source_detail` for later updates. */
export function withMem0Id(sourceDetail: string | null | undefined, mem0Id: string): string {
  const token = `${MEM0_ID_PREFIX}${mem0Id}`;
  if (!sourceDetail) return token;
  if (sourceDetail.includes(token)) return sourceDetail;
  return `${sourceDetail};${token}`;
}

export function parseMem0Id(sourceDetail: string | null | undefined): string | null {
  if (!sourceDetail) return null;
  const match = sourceDetail.match(/mem0:([0-9a-f-]{36})/i);
  return match?.[1] ?? null;
}

export function toExpirationDate(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const date = expiresAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}
