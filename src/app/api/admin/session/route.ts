import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/admin/auth";
import { isAdminRole, isSuperAdminRole } from "@/lib/admin/roles";

/**
 * GET /api/admin/session — staff session probe (support+).
 * Proves server-side role resolution for the admin console.
 */
export async function GET() {
  const result = await requireApiRole("support");
  if (!result.ok) return result.response;

  const { ctx } = result;
  return NextResponse.json({
    ok: true,
    userId: ctx.user.id,
    role: ctx.role,
    capabilities: {
      staff: true,
      admin: isAdminRole(ctx.role),
      superAdmin: isSuperAdminRole(ctx.role),
    },
  });
}
