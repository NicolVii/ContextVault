import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import { recordAdminAudit } from "@/lib/admin/audit";

const bodySchema = z.object({
  action: z.enum(["staff_ping", "admin_ping", "super_only"]),
});

/**
 * POST /api/admin/actions — role-gated admin actions.
 * - staff_ping: support+
 * - admin_ping: admin+
 * - super_only: super_admin only (also writes admin_audit_log)
 */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { action } = parsed.data;
  const minimum =
    action === "super_only"
      ? "super_admin"
      : action === "admin_ping"
        ? "admin"
        : "support";

  const result = await requireApiRole(minimum);
  if (!result.ok) return result.response;

  const { ctx } = result;

  if (action === "super_only") {
    await recordAdminAudit({
      actorUserId: ctx.user.id,
      action: "admin.super_only_action",
      targetType: "admin_console",
      metadata: { via: "api/admin/actions" },
    });
  }

  return NextResponse.json({
    ok: true,
    action,
    role: ctx.role,
  });
}
