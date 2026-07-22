import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import { MODEL_FAMILIES } from "@/lib/billing/plan-defaults";
import {
  createPlanCampaignOverride,
  revokePlanCampaignOverride,
} from "@/lib/billing/plan-editor";
import { isLaunchPlanId } from "@/lib/billing/plan-config";

const modelFamilySchema = z.enum(
  MODEL_FAMILIES as unknown as [string, ...string[]]
);

const overridesSchema = z
  .object({
    autoMonthlyTurns: z.number().int().nonnegative().nullable().optional(),
    autoFairUseDailyCredits: z.number().int().nonnegative().optional(),
    autoFairUsePeriodCredits: z.number().int().nonnegative().optional(),
    frontierMonthlyTurns: z.number().int().nonnegative().nullable().optional(),
    maxFrontierCreditsPerTurn: z.number().int().nonnegative().optional(),
    frontierSoftCreditCap: z.number().int().nonnegative().nullable().optional(),
    frontierHeavyRatio: z.number().min(0).max(1).optional(),
    attachments: z.boolean().optional(),
    storageBytes: z.number().int().nonnegative().optional(),
    byok: z.boolean().optional(),
    voice: z.boolean().optional(),
    elevatedLimits: z.boolean().optional(),
    modelFamilies: z.array(modelFamilySchema).optional(),
  })
  .strict();

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    planId: z.enum(["free", "lite", "pro"]),
    name: z.string().min(1).max(200),
    reason: z.string().min(3).max(2000),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    entitlementOverrides: overridesSchema,
  }),
  z.object({
    action: z.literal("revoke"),
    id: z.string().uuid(),
    reason: z.string().min(3).max(2000),
  }),
]);

/**
 * POST /api/admin/plans/campaigns — create or revoke temporary plan campaigns.
 * Example: raise Lite Frontier turns from 10 → 25 for one month.
 */
export async function POST(request: Request) {
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
  const { ctx } = auth;
  const body = parsed.data;

  try {
    if (body.action === "create") {
      if (!isLaunchPlanId(body.planId)) {
        return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
      }
      const campaign = await createPlanCampaignOverride({
        planId: body.planId,
        name: body.name,
        reason: body.reason,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        entitlementOverrides: body.entitlementOverrides as never,
        actorUserId: ctx.user.id,
      });
      return NextResponse.json({
        ok: true,
        action: body.action,
        campaign,
      });
    }

    const campaign = await revokePlanCampaignOverride({
      id: body.id,
      reason: body.reason,
      actorUserId: ctx.user.id,
    });
    return NextResponse.json({
      ok: true,
      action: body.action,
      campaign,
    });
  } catch (err) {
    console.error("POST /api/admin/plans/campaigns failed", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Campaign mutation failed",
      },
      { status: 400 }
    );
  }
}
