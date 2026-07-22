import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import {
  listEligibleAutomaticPromotions,
  listRedemptionsForUser,
  redeemPromotion,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

const redeemSchema = z.object({
  code: z.string().min(3).max(64).optional(),
  promotionId: z.string().uuid().optional(),
  /** When true, redeem an automatic campaign by id. */
  automatic: z.boolean().optional(),
});

/**
 * GET /api/billing/promotions — user's redemptions + eligible automatic campaigns.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [redemptions, automatic] = await Promise.all([
      listRedemptionsForUser(ctx.user.id),
      listEligibleAutomaticPromotions(ctx.user.id),
    ]);
    return NextResponse.json({
      redemptions,
      eligibleAutomatic: automatic.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        endsAt: p.endsAt,
        priceEffect: p.priceEffect,
        bonusEffect: p.bonusEffect,
      })),
    });
  } catch (err) {
    console.error("GET /api/billing/promotions failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/promotions — redeem a public code or automatic campaign.
 */
export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = redeemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (!parsed.data.code && !parsed.data.promotionId) {
    return NextResponse.json(
      { error: "Provide a code or promotionId" },
      { status: 400 }
    );
  }

  try {
    const source = parsed.data.automatic
      ? "automatic"
      : parsed.data.code
        ? "code"
        : "automatic";

    const result = await redeemPromotion({
      code: parsed.data.code,
      promotionId: parsed.data.promotionId,
      userId: ctx.user.id,
      source,
    });

    return NextResponse.json({
      ok: true,
      redemption: result.redemption,
      promotion: {
        id: result.promotion.id,
        slug: result.promotion.slug,
        name: result.promotion.name,
      },
      demoSimulated: result.demoSimulated,
    });
  } catch (err) {
    console.error("POST /api/billing/promotions failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Redemption failed" },
      { status: 400 }
    );
  }
}
