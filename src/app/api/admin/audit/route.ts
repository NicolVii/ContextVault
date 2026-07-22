import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/admin/auth";
import { listAdminAuditEntries } from "@/lib/admin/console";

export const dynamic = "force-dynamic";

/** GET /api/admin/audit — staff+ admin audit browser. */
export async function GET(request: Request) {
  const result = await requireApiRole("support");
  if (!result.ok) return result.response;

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? undefined;
  const targetUserId = url.searchParams.get("targetUserId") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const entries = await listAdminAuditEntries({
      action,
      targetUserId,
      limit,
    });
    return NextResponse.json({ ok: true, entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load audit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
