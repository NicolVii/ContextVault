import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/admin/auth";
import { listAdminUsers } from "@/lib/admin/console";

export const dynamic = "force-dynamic";

/** GET /api/admin/users?q=&limit= — staff+ user directory. */
export async function GET(request: Request) {
  const result = await requireApiRole("support");
  if (!result.ok) return result.response;

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const users = await listAdminUsers({ q, limit });
    return NextResponse.json({ ok: true, users });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
