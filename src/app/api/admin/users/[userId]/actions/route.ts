import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import {
  createEntitlementGrant,
  createPlanSimulation,
  endPlanSimulation,
  revokeEntitlementGrant,
} from "@/lib/billing/admin-entitlements";
import {
  grantAutoBonus,
  grantCreditBonus,
  grantFrontierBonus,
  resetUserPlanUsage,
} from "@/lib/admin/mutations";

export const dynamic = "force-dynamic";

const featureOverridesSchema = z
  .object({
    attachments: z.boolean().optional(),
    byok: z.boolean().optional(),
    voice: z.boolean().optional(),
    elevatedLimits: z.boolean().optional(),
  })
  .strict()
  .optional();

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("temporary_plan_grant"),
    planId: z.enum(["free", "lite", "pro"]),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    autoTurnBonus: z.number().int().min(0).optional(),
    frontierTurnBonus: z.number().int().min(0).optional(),
    creditBonus: z.number().int().min(0).optional(),
    storageBytesOverride: z.number().int().min(0).nullable().optional(),
    featureOverrides: featureOverridesSchema,
    reason: z.string().min(3).max(2000),
  }),
  z.object({
    action: z.literal("plan_simulation"),
    planId: z.enum(["free", "lite", "pro"]),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    autoTurnBonus: z.number().int().min(0).optional(),
    frontierTurnBonus: z.number().int().min(0).optional(),
    creditBonus: z.number().int().min(0).optional(),
    storageBytesOverride: z.number().int().min(0).nullable().optional(),
    featureOverrides: featureOverridesSchema,
    reason: z.string().min(3).max(2000),
  }),
  z.object({
    action: z.literal("end_simulation"),
    id: z.string().uuid(),
    reason: z.string().min(3).max(2000).optional(),
  }),
  z.object({
    action: z.literal("revoke_grant"),
    id: z.string().uuid(),
    reason: z.string().min(3).max(2000).optional(),
  }),
  z.object({
    action: z.literal("auto_bonus"),
    amount: z.number().int().positive(),
    endsAt: z.string().datetime().nullable().optional(),
    reason: z.string().min(3).max(2000),
  }),
  z.object({
    action: z.literal("frontier_bonus"),
    amount: z.number().int().positive(),
    endsAt: z.string().datetime().nullable().optional(),
    reason: z.string().min(3).max(2000),
  }),
  z.object({
    action: z.literal("credit_bonus"),
    amount: z.number().int().positive(),
    reason: z.string().min(3).max(2000),
  }),
  z.object({
    action: z.literal("usage_reset"),
    reason: z.string().min(3).max(2000),
  }),
]);

const paramsSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * POST /api/admin/users/[userId]/actions — admin+ mutations for a user.
 * Every successful mutation is audited (via helpers / entitlement lib).
 */
export async function POST(
  request: Request,
  context: { params: { userId: string } }
) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const userId = params.data.userId;
  const body = parsed.data;

  try {
    if (body.action === "temporary_plan_grant") {
      const grant = await createEntitlementGrant({
        userId,
        planId: body.planId,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        autoTurnBonus: body.autoTurnBonus,
        frontierTurnBonus: body.frontierTurnBonus,
        creditBonus: body.creditBonus,
        storageBytesOverride: body.storageBytesOverride,
        featureOverrides: body.featureOverrides,
        reason: body.reason,
        createdBy: ctx.user.id,
      });
      return NextResponse.json({ ok: true, action: body.action, grant });
    }

    if (body.action === "plan_simulation") {
      const simulation = await createPlanSimulation({
        userId,
        planId: body.planId,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        autoTurnBonus: body.autoTurnBonus,
        frontierTurnBonus: body.frontierTurnBonus,
        creditBonus: body.creditBonus,
        storageBytesOverride: body.storageBytesOverride,
        featureOverrides: body.featureOverrides,
        reason: body.reason,
        createdBy: ctx.user.id,
      });
      return NextResponse.json({ ok: true, action: body.action, simulation });
    }

    if (body.action === "end_simulation") {
      const simulation = await endPlanSimulation(
        body.id,
        ctx.user.id,
        body.reason
      );
      if (!simulation) {
        return NextResponse.json(
          { error: "Simulation not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, action: body.action, simulation });
    }

    if (body.action === "revoke_grant") {
      const grant = await revokeEntitlementGrant(
        body.id,
        ctx.user.id,
        body.reason
      );
      if (!grant) {
        return NextResponse.json({ error: "Grant not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, action: body.action, grant });
    }

    if (body.action === "auto_bonus") {
      const grant = await grantAutoBonus({
        userId,
        actorUserId: ctx.user.id,
        amount: body.amount,
        reason: body.reason,
        endsAt: body.endsAt,
      });
      return NextResponse.json({ ok: true, action: body.action, grant });
    }

    if (body.action === "frontier_bonus") {
      const grant = await grantFrontierBonus({
        userId,
        actorUserId: ctx.user.id,
        amount: body.amount,
        reason: body.reason,
        endsAt: body.endsAt,
      });
      return NextResponse.json({ ok: true, action: body.action, grant });
    }

    if (body.action === "credit_bonus") {
      const result = await grantCreditBonus({
        userId,
        actorUserId: ctx.user.id,
        amount: body.amount,
        reason: body.reason,
      });
      return NextResponse.json({ ok: true, action: body.action, ...result });
    }

    const result = await resetUserPlanUsage({
      userId,
      actorUserId: ctx.user.id,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true, action: body.action, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
