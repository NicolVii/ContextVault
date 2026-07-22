import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import { listAdapters } from "@/lib/inference/adapters";
import { updateProviderConfig } from "@/lib/inference/provider-ops";

const bodySchema = z.object({
  reason: z.string().min(3).max(2000),
  enabled: z.boolean().optional(),
  fallbackPriority: z.number().int().min(0).max(10_000).optional(),
  dailyCostCeilingUsdMicros: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),
  mockOnly: z.boolean().optional(),
  allowPlatform: z.boolean().optional(),
  allowByok: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

type RouteContext = { params: { providerId: string } };

/**
 * PATCH /api/admin/providers/[providerId] — update provider ops config.
 * Never accepts or returns API keys.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const providerId = context.params.providerId;
  if (!listAdapters().includes(providerId)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid body",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const { reason, ...patch } = parsed.data;
  if (
    patch.enabled === undefined &&
    patch.fallbackPriority === undefined &&
    patch.dailyCostCeilingUsdMicros === undefined &&
    patch.mockOnly === undefined &&
    patch.allowPlatform === undefined &&
    patch.allowByok === undefined &&
    patch.notes === undefined
  ) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  try {
    const provider = await updateProviderConfig({
      providerId,
      patch,
      actorUserId: auth.ctx.user.id,
      reason,
    });
    return NextResponse.json({ ok: true, provider });
  } catch (err) {
    console.error("PATCH /api/admin/providers/[providerId] failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Provider update failed",
      },
      { status: 400 }
    );
  }
}
