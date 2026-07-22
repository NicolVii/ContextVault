import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { grantCredits } from "@/lib/inference/credits";
import { isDevTopupAllowed } from "@/lib/billing/dev-topup";
import { resolveCommercialMode } from "@/lib/billing/commercial";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  credits: z.number().int().min(1_000).max(5_000_000).default(100_000),
});

/**
 * Local/dev credit top-up in commercial demo mode.
 * Unconditionally disabled in production and when COMMERCIAL_MODE=live.
 */
export async function POST(request: Request) {
  if (!isDevTopupAllowed()) {
    const mode = resolveCommercialMode();
    const error =
      mode === "live"
        ? "Use Stripe Checkout in this environment"
        : "Dev top-up disabled";
    return NextResponse.json({ error }, { status: 403 });
  }

  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const balance = await grantCredits(ctx.user.id, parsed.data.credits, "dev_topup");
  return NextResponse.json({ balance, granted: parsed.data.credits });
}
