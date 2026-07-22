import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import { isAdminRole } from "@/lib/admin/roles";
import {
  activatePromotion,
  archivePromotion,
  createPromotion,
  endPromotion,
  getPromotionById,
  listPromotions,
  listRedemptionsForPromotion,
  pausePromotion,
  promotionInputSchema,
  resumePromotion,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/promotions — list promotions (staff read).
 */
export async function GET(request: Request) {
  const auth = await requireApiRole("support");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const statuses = status
    ? status.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  try {
    const promotions = await listPromotions({
      status: statuses as never,
      limit: 200,
    });
    return NextResponse.json({ promotions });
  } catch (err) {
    console.error("GET /api/admin/promotions failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list promotions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/promotions — create a promotion (admin+).
 */
export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;
  if (!isAdminRole(auth.ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const raw = json as Record<string, unknown>;
  const activate = Boolean(raw.activate);
  const { activate: _ignored, ...rest } = raw;
  const parsed = promotionInputSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid body",
        details: parsed.error.issues.map(
          (i: { path: (string | number)[]; message: string }) => ({
            path: i.path.join("."),
            message: i.message,
          })
        ),
      },
      { status: 400 }
    );
  }

  try {
    const promotion = await createPromotion({
      input: parsed.data,
      actorUserId: auth.ctx.user.id,
      activate,
    });
    return NextResponse.json({ ok: true, promotion });
  } catch (err) {
    console.error("POST /api/admin/promotions failed", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to create promotion",
      },
      { status: 400 }
    );
  }
}

const mutateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["activate", "pause", "resume", "end", "archive"]),
    id: z.string().uuid(),
    reason: z.string().min(3).max(2000),
  }),
  z.object({
    action: z.literal("detail"),
    id: z.string().uuid(),
  }),
]);

/**
 * PATCH /api/admin/promotions — lifecycle actions (admin+) or detail+redemptions (staff).
 */
export async function PATCH(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = mutateSchema.safeParse(json);
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

  if (parsed.data.action === "detail") {
    const auth = await requireApiRole("support");
    if (!auth.ok) return auth.response;
    try {
      const promotion = await getPromotionById(parsed.data.id);
      if (!promotion) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const redemptions = await listRedemptionsForPromotion(promotion.id);
      return NextResponse.json({ promotion, redemptions });
    } catch (err) {
      console.error("PATCH /api/admin/promotions detail failed", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed" },
        { status: 500 }
      );
    }
  }

  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const { action, id, reason } = parsed.data;
  const actorUserId = auth.ctx.user.id;

  try {
    let promotion;
    switch (action) {
      case "activate":
        promotion = await activatePromotion({ id, reason, actorUserId });
        break;
      case "pause":
        promotion = await pausePromotion({ id, reason, actorUserId });
        break;
      case "resume":
        promotion = await resumePromotion({ id, reason, actorUserId });
        break;
      case "end":
        promotion = await endPromotion({ id, reason, actorUserId });
        break;
      case "archive":
        promotion = await archivePromotion({ id, reason, actorUserId });
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, action, promotion });
  } catch (err) {
    console.error("PATCH /api/admin/promotions failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Mutation failed" },
      { status: 400 }
    );
  }
}
