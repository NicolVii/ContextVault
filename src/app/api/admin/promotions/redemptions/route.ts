import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import {
  redeemPromotion,
  revokeRedemption,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("redeem"),
    promotionId: z.string().uuid(),
    userId: z.string().uuid(),
    reason: z.string().min(3).max(2000),
  }),
  z.object({
    action: z.literal("revoke"),
    redemptionId: z.string().uuid(),
    reason: z.string().min(3).max(2000),
  }),
]);

/**
 * POST /api/admin/promotions/redemptions — admin redeem or revoke.
 */
export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

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

  try {
    if (parsed.data.action === "redeem") {
      const result = await redeemPromotion({
        promotionId: parsed.data.promotionId,
        userId: parsed.data.userId,
        source: "admin",
        actorUserId: auth.ctx.user.id,
        metadata: { reason: parsed.data.reason },
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const redemption = await revokeRedemption({
      redemptionId: parsed.data.redemptionId,
      reason: parsed.data.reason,
      actorUserId: auth.ctx.user.id,
    });
    return NextResponse.json({ ok: true, redemption });
  } catch (err) {
    console.error("POST /api/admin/promotions/redemptions failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Redemption action failed" },
      { status: 400 }
    );
  }
}
