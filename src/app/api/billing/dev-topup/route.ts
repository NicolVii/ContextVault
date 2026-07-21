import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { grantCredits } from "@/lib/inference/credits";
import { isStripeConfigured } from "@/lib/billing/products";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  credits: z.number().int().min(1_000).max(5_000_000).default(100_000),
});

/**
 * Local/dev credit top-up when Stripe is not configured.
 * Disabled whenever STRIPE_SECRET_KEY is set.
 */
export async function POST(request: Request) {
  if (isStripeConfigured()) {
    return NextResponse.json({ error: "Use Stripe Checkout in this environment" }, { status: 403 });
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_TOPUP !== "1") {
    return NextResponse.json({ error: "Dev top-up disabled" }, { status: 403 });
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
