import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import {
  evaluateLiveReadiness,
  reconcileAllSubscriptions,
  reconcileUserSubscription,
} from "@/lib/billing";
import { recordAdminAudit } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/billing/readiness — live-mode readiness report (staff+).
 * Never returns secrets; only presence / status.
 */
export async function GET() {
  const auth = await requireApiRole("support");
  if (!auth.ok) return auth.response;

  try {
    const readiness = await evaluateLiveReadiness();
    return NextResponse.json({ ok: true, readiness });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to evaluate readiness",
      },
      { status: 500 }
    );
  }
}

const reconcileSchema = z.object({
  userId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  reason: z.string().min(3).max(2000),
});

/**
 * POST /api/admin/billing/readiness — run Stripe→DB reconciliation (admin+).
 * Stripe remains financial source of truth; admin grants are never rewritten.
 */
export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = reconcileSchema.safeParse(json);
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
    if (parsed.data.userId) {
      const result = await reconcileUserSubscription(parsed.data.userId);
      await recordAdminAudit({
        actorUserId: auth.ctx.user.id,
        action: "admin.billing.reconcile_user",
        targetType: "subscriptions",
        targetId: parsed.data.userId,
        metadata: {
          reason: parsed.data.reason,
          action: result.action,
          drift: result.drift,
        },
      });
      return NextResponse.json({ ok: true, result });
    }

    const batch = await reconcileAllSubscriptions({
      limit: parsed.data.limit,
    });
    await recordAdminAudit({
      actorUserId: auth.ctx.user.id,
      action: "admin.billing.reconcile_batch",
      targetType: "subscriptions",
      targetId: null,
      metadata: {
        reason: parsed.data.reason,
        scanned: batch.scanned,
        updated: batch.updated,
        canceled: batch.canceled,
        unchanged: batch.unchanged,
        skipped: batch.skipped,
      },
    });
    return NextResponse.json({ ok: true, batch });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Reconciliation failed",
      },
      { status: 500 }
    );
  }
}
