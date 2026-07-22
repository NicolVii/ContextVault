import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/admin/auth";
import { listAdminPlans } from "@/lib/billing/plan-editor";

/**
 * GET /api/admin/plans — list Free / Lite / Pro for the plan editor.
 * Support+ may read; mutations require admin+.
 */
export async function GET() {
  const result = await requireApiRole("support");
  if (!result.ok) return result.response;

  try {
    const plans = await listAdminPlans();
    return NextResponse.json({ plans });
  } catch (err) {
    console.error("GET /api/admin/plans failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list plans" },
      { status: 500 }
    );
  }
}
