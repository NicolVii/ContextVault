import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/admin/auth";
import { listAdapters } from "@/lib/inference/adapters";
import { runProviderHealthTest } from "@/lib/inference/provider-ops";

export const dynamic = "force-dynamic";

type RouteContext = { params: { providerId: string } };

/**
 * POST /api/admin/providers/[providerId]/health — safe platform health probe.
 * Uses env keys only. Never returns secrets or vendor response bodies.
 */
export async function POST(_request: Request, context: RouteContext) {
  const providerId = context.params.providerId;
  if (!listAdapters().includes(providerId)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  try {
    const result = await runProviderHealthTest({
      providerId,
      actorUserId: auth.ctx.user.id,
    });
    return NextResponse.json({
      ok: true,
      providerId,
      configured: result.configured,
      healthy: result.ok,
      latencyMs: result.latencyMs,
      errorClass: result.errorClass,
    });
  } catch (err) {
    console.error("POST /api/admin/providers/[providerId]/health failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Health test failed",
      },
      { status: 500 }
    );
  }
}
