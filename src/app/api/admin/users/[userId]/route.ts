import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/admin/auth";
import { getAdminUserDetail } from "@/lib/admin/console";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  userId: z.string().uuid(),
});

/** GET /api/admin/users/[userId] — staff+ full operator view. */
export async function GET(
  _request: Request,
  context: { params: { userId: string } }
) {
  const result = await requireApiRole("support");
  if (!result.ok) return result.response;

  const parsed = paramsSchema.safeParse(context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const detail = await getAdminUserDetail(parsed.data.userId);
    if (!detail) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, user: detail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
