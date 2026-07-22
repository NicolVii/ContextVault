import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/admin/auth";
import {
  getAdminUsageEconomics,
  type AdminUsageFilterInput,
} from "@/lib/admin/usage-economics";

export const dynamic = "force-dynamic";

function pickParam(
  params: URLSearchParams,
  key: string
): string | null {
  const v = params.get(key);
  return v?.trim() ? v.trim() : null;
}

/** GET /api/admin/usage — staff+ Usage & Economics aggregates (no raw events). */
export async function GET(request: Request) {
  const result = await requireApiRole("support");
  if (!result.ok) return result.response;

  try {
    const url = new URL(request.url);
    const daysRaw = pickParam(url.searchParams, "days");
    const filters: AdminUsageFilterInput = {
      from: pickParam(url.searchParams, "from"),
      to: pickParam(url.searchParams, "to"),
      days: daysRaw != null ? Number(daysRaw) : null,
      planId: pickParam(url.searchParams, "plan"),
      provider: pickParam(url.searchParams, "provider"),
      modelId: pickParam(url.searchParams, "model"),
      intensity: pickParam(url.searchParams, "intensity"),
      billingMode: pickParam(url.searchParams, "billingMode"),
      audience: pickParam(url.searchParams, "audience"),
    };

    const stats = await getAdminUsageEconomics(filters);
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load usage economics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
