import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/admin/auth";
import { getAdminOverviewStats } from "@/lib/admin/console";

export const dynamic = "force-dynamic";

/** GET /api/admin/overview — staff+ platform stats for the console home. */
export async function GET() {
  const result = await requireApiRole("support");
  if (!result.ok) return result.response;

  try {
    const stats = await getAdminOverviewStats();
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
