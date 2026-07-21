export const MEMORY_TYPES = [
  "profile",
  "preference",
  "semantic",
  "episodic",
  "project",
  "temporary",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_STATUSES = [
  "active",
  "proposed",
  "rejected",
  "superseded",
  "archived",
  "deleted",
] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export const MEMORY_SOURCES = [
  "manual",
  "chat_extraction",
  "document",
  "onboarding",
  "import",
] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export interface Memory {
  id: string;
  user_id: string;
  content: string;
  category: string | null;
  type: MemoryType;
  source: MemorySource;
  source_detail: string | null;
  confidence: number;
  status: MemoryStatus;
  is_sensitive: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  persona: string | null;
  default_model: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Allowlisted account identity injected into every chat system prompt.
 * Only these fields — never email or other profile columns.
 */
export interface UserIdentity {
  displayName?: string;
  persona?: string;
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  status: "processing" | "ready" | "failed";
  error: string | null;
  created_at: string;
}

export interface RetrievedMemory {
  id: string;
  content: string;
  category: string | null;
  type: MemoryType;
  source: MemorySource;
  source_detail: string | null;
  confidence: number;
  created_at: string;
  similarity: number;
}

export interface RetrievedChunk {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  page_number: number | null;
  similarity: number;
}

export interface MemoryTypeMeta {
  label: string;
  description: string;
}

export const MEMORY_TYPE_META: Record<MemoryType, MemoryTypeMeta> = {
  profile: { label: "Profile", description: "Core facts about who you are" },
  preference: { label: "Preference", description: "How you like things done" },
  semantic: { label: "Knowledge", description: "General facts you want remembered" },
  episodic: { label: "Event", description: "Something that happened" },
  project: { label: "Project", description: "Context for ongoing work" },
  temporary: { label: "Temporary", description: "Short-lived, may expire" },
};
