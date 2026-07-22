import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import {
  createEntitlementGrant,
  createPlanSimulation,
  endPlanSimulation,
  revokeEntitlementGrant,
} from "@/lib/billing/admin-entitlements";

const featureOverridesSchema = z
  .object({
    attachments: z.boolean().optional(),
    byok: z.boolean().optional(),
    voice: z.boolean().optional(),
    elevatedLimits: z.boolean().optional(),
  })
  .strict()
  .optional();

const createFields = {
  userId: z.string().uuid(),
  planId: z.enum(["free", "lite", "pro"]),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  autoTurnBonus: z.number().int().min(0).optional(),
  frontierTurnBonus: z.number().int().min(0).optional(),
  creditBonus: z.number().int().min(0).optional(),
  storageBytesOverride: z.number().int().min(0).nullable().optional(),
  featureOverrides: featureOverridesSchema,
  reason: z.string().max(2000).nullable().optional(),
};

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_grant"),
    ...createFields,
  }),
  z.object({
    action: z.literal("create_simulation"),
    ...createFields,
  }),
  z.object({
    action: z.literal("revoke_grant"),
    id: z.string().uuid(),
    reason: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("end_simulation"),
    id: z.string().uuid(),
    reason: z.string().max(2000).nullable().optional(),
  }),
]);

/**
 * POST /api/admin/entitlements — admin+ mutations for demo grants and
 * plan simulations. Every mutation is recorded in admin_audit_log.
 */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await requireApiRole("admin");
  if (!result.ok) return result.response;
  const { ctx } = result;
  const body = parsed.data;

  try {
    if (body.action === "create_grant") {
      const row = await createEntitlementGrant({
        userId: body.userId,
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
      return NextResponse.json({ ok: true, action: body.action, grant: row });
    }

    if (body.action === "create_simulation") {
      const row = await createPlanSimulation({
        userId: body.userId,
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
      return NextResponse.json({
        ok: true,
        action: body.action,
        simulation: row,
      });
    }

    if (body.action === "revoke_grant") {
      const row = await revokeEntitlementGrant(
        body.id,
        ctx.user.id,
        body.reason
      );
      if (!row) {
        return NextResponse.json({ error: "Grant not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, action: body.action, grant: row });
    }

    const row = await endPlanSimulation(body.id, ctx.user.id, body.reason);
    if (!row) {
      return NextResponse.json(
        { error: "Simulation not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      ok: true,
      action: body.action,
      simulation: row,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
