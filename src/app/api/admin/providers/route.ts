import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/admin/auth";
import { listProviderAdminViews } from "@/lib/inference/provider-ops";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/providers — provider + model ops dashboard.
 * Never returns API keys or BYOK material — only configured booleans and metrics.
 */
export async function GET() {
  const result = await requireApiRole("support");
  if (!result.ok) return result.response;

  try {
    const { providers, models } = await listProviderAdminViews({
      windowDays: 30,
    });
    return NextResponse.json({
      ok: true,
      providers,
      models,
      windowDays: 30,
    });
  } catch (err) {
    console.error("GET /api/admin/providers failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load providers",
      },
      { status: 500 }
    );
  }
}
