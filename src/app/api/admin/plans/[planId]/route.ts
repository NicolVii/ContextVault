import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import { MODEL_FAMILIES } from "@/lib/billing/plan-defaults";
import {
  getAdminPlanDetail,
  publishPlanVersion,
  rollbackPlanVersion,
} from "@/lib/billing/plan-editor";
import { isLaunchPlanId } from "@/lib/billing/plan-config";

const modelFamilySchema = z.enum(
  MODEL_FAMILIES as unknown as [string, ...string[]]
);

const productSchema = z.object({
  label: z.string().min(1),
  purpose: z.string().min(1),
  amountEurCentsMonthly: z.number().int().nonnegative(),
  amountEurCentsAnnual: z.number().int().nonnegative().nullable().optional(),
  foundingEurCentsMonthly: z.number().int().nonnegative().nullable().optional(),
  stripePriceEnvMonthly: z.string().min(1).nullable().optional(),
  stripePriceEnvAnnual: z.string().min(1).nullable().optional(),
  features: z.array(z.string().min(1)).min(1),
  public: z.boolean(),
});

const entitlementsSchema = z.object({
  autoMonthlyTurns: z.number().int().nonnegative().nullable(),
  unlimitedAuto: z.boolean(),
  autoFairUseDailyCredits: z.number().int().nonnegative(),
  autoFairUsePeriodCredits: z.number().int().nonnegative(),
  frontierMonthlyTurns: z.number().int().nonnegative().nullable(),
  maxFrontierCreditsPerTurn: z.number().int().nonnegative(),
  frontierSoftCreditCap: z.number().int().nonnegative().nullable(),
  frontierHeavyRatio: z.number().min(0).max(1),
  attachments: z.boolean(),
  storageBytes: z.number().int().nonnegative(),
  byok: z.boolean(),
  voice: z.boolean(),
  elevatedLimits: z.boolean(),
  modelFamilies: z.array(modelFamilySchema),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("publish"),
    reason: z.string().min(3).max(2000),
    product: productSchema,
    entitlements: entitlementsSchema,
    effectiveFrom: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal("rollback"),
    reason: z.string().min(3).max(2000),
    toVersionId: z.string().uuid(),
  }),
]);

type RouteContext = { params: { planId: string } };

/**
 * GET /api/admin/plans/[planId] — plan detail with versions + campaigns.
 */
export async function GET(_request: Request, context: RouteContext) {
  const result = await requireApiRole("support");
  if (!result.ok) return result.response;

  const planId = context.params.planId;
  if (!isLaunchPlanId(planId)) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 404 });
  }

  try {
    const detail = await getAdminPlanDetail(planId);
    return NextResponse.json({ plan: detail });
  } catch (err) {
    console.error("GET /api/admin/plans/[planId] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load plan" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/plans/[planId] — publish a new version or rollback.
 * Requires admin+. Every mutation needs a reason and is audited.
 */
export async function POST(request: Request, context: RouteContext) {
  const planId = context.params.planId;
  if (!isLaunchPlanId(planId)) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 404 });
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
  const { ctx } = auth;
  const body = parsed.data;

  try {
    if (body.action === "publish") {
      const version = await publishPlanVersion({
        planId,
        product: {
          ...body.product,
          amountEurCentsAnnual: body.product.amountEurCentsAnnual ?? null,
          foundingEurCentsMonthly:
            body.product.foundingEurCentsMonthly ?? null,
          stripePriceEnvMonthly: body.product.stripePriceEnvMonthly ?? null,
          stripePriceEnvAnnual: body.product.stripePriceEnvAnnual ?? null,
        },
        entitlements: {
          ...body.entitlements,
          modelFamilies: body.entitlements.modelFamilies as never,
        },
        reason: body.reason,
        actorUserId: ctx.user.id,
        effectiveFrom: body.effectiveFrom,
      });
      return NextResponse.json({
        ok: true,
        action: body.action,
        version,
      });
    }

    const version = await rollbackPlanVersion({
      planId,
      toVersionId: body.toVersionId,
      reason: body.reason,
      actorUserId: ctx.user.id,
    });
    return NextResponse.json({
      ok: true,
      action: body.action,
      version,
    });
  } catch (err) {
    console.error("POST /api/admin/plans/[planId] failed", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Plan mutation failed",
      },
      { status: 400 }
    );
  }
}
