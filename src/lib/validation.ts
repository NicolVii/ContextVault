import { z } from "zod";
import { MEMORY_TYPES } from "@/lib/types";

export const memoryTypeSchema = z.enum(MEMORY_TYPES);

export const createMemorySchema = z.object({
  content: z.string().trim().min(1).max(8000),
  type: memoryTypeSchema.default("semantic"),
  category: z.string().trim().max(120).optional().nullable(),
  confidence: z.number().min(0).max(1).default(1),
  expires_at: z.string().datetime().optional().nullable(),
});

export const updateMemorySchema = z.object({
  content: z.string().trim().min(1).max(8000).optional(),
  type: memoryTypeSchema.optional(),
  category: z.string().trim().max(120).optional().nullable(),
  confidence: z.number().min(0).max(1).optional(),
  status: z
    .enum(["active", "proposed", "rejected", "superseded", "archived"])
    .optional(),
  expires_at: z.string().datetime().optional().nullable(),
  /** ISO timestamp to pin; null to unpin. */
  pinned_at: z.string().datetime().optional().nullable(),
});

export const chatRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(8000),
    /** @deprecated Prefer `selection` (auto | preset:* | model id). */
    model: z.string().min(1).optional(),
    /** Selection policy: auto | preset:coding | cortaix model id | legacy provider id. */
    selection: z.string().min(1).optional(),
    sessionId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => Boolean(v.selection ?? v.model), {
    message: "selection or model is required",
  });

export const profileSchema = z.object({
  display_name: z.string().trim().max(120).optional().nullable(),
  persona: z.string().trim().max(2000).optional().nullable(),
  default_model: z.string().min(1).optional(),
  onboarding_completed: z.boolean().optional(),
});

export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
] as const;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MiB
