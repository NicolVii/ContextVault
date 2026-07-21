import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import {
  ensureCreditAccount,
  getCreditBalance,
} from "@/lib/inference/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured } from "@/lib/billing/products";

export const dynamic = "force-dynamic";

/** Return the caller's credit wallet, plan, and recent usage. */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureCreditAccount(ctx.user.id);
  const balance = await getCreditBalance(ctx.user.id);

  const admin = createSupabaseAdminClient();
  const [{ data: recent }, { data: sub }] = await Promise.all([
    admin
      .from("usage_events")
      .select(
        "request_id, purpose, model_id, provider, credits_charged, input_tokens, output_tokens, created_at"
      )
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("subscriptions")
      .select("plan_id, status, current_period_end, cancel_at_period_end")
      .eq("user_id", ctx.user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    balance,
    planId: (sub?.plan_id as string) ?? "free",
    planStatus: (sub?.status as string) ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    stripeConfigured: isStripeConfigured(),
    recent: recent ?? [],
  });
}
