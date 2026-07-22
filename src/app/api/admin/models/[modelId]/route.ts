import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import { MODEL_CATALOG } from "@/lib/inference/models";
import { updateModelOverride } from "@/lib/inference/provider-ops";

const bodySchema = z.object({
  reason: z.string().min(3).max(2000),
  enabled: z.boolean().optional(),
  autoEligible: z.boolean().optional(),
  frontierEligible: z.boolean().optional(),
});

type RouteContext = { params: { modelId: string } };

/**
 * PATCH /api/admin/models/[modelId] — model enablement + Auto/Frontier eligibility.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const modelId = decodeURIComponent(context.params.modelId);
  if (!MODEL_CATALOG.some((m) => m.id === modelId)) {
    return NextResponse.json({ error: "Unknown model" }, { status: 404 });
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
    patch.autoEligible === undefined &&
    patch.frontierEligible === undefined
  ) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  try {
    const model = await updateModelOverride({
      modelId,
      patch,
      actorUserId: auth.ctx.user.id,
      reason,
    });
    return NextResponse.json({ ok: true, model });
  } catch (err) {
    console.error("PATCH /api/admin/models/[modelId] failed", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Model update failed",
      },
      { status: 400 }
    );
  }
}
