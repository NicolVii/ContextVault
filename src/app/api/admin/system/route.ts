import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import { getSystemHealthReport } from "@/lib/admin/system-health";
import {
  isOperationalControlKey,
  updateOperationalControl,
} from "@/lib/admin/system-controls";

export const dynamic = "force-dynamic";

/** GET /api/admin/system — staff+ system health + operational controls. */
export async function GET() {
  const result = await requireApiRole("support");
  if (!result.ok) return result.response;

  try {
    const report = await getSystemHealthReport();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load system health";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const patchSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  reason: z.string().min(3).max(2000),
  expiresAt: z.union([z.string().min(1), z.null()]).optional(),
  targetIds: z.array(z.string().min(1).max(128)).max(100).optional(),
});

/** PATCH /api/admin/system — admin+ update an operational control (audited). */
export async function PATCH(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
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

  if (!isOperationalControlKey(parsed.data.key)) {
    return NextResponse.json({ error: "Unknown control key" }, { status: 400 });
  }

  try {
    const control = await updateOperationalControl({
      key: parsed.data.key,
      enabled: parsed.data.enabled,
      reason: parsed.data.reason,
      expiresAt: parsed.data.expiresAt ?? null,
      targetIds: parsed.data.targetIds,
      actorUserId: auth.ctx.user.id,
    });
    return NextResponse.json({ ok: true, control });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Control update failed",
      },
      { status: 400 }
    );
  }
}
