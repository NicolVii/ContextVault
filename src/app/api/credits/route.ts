import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import {
  ensureCreditAccount,
  getCreditBalance,
} from "@/lib/inference/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Return the caller's credit wallet balance and recent usage. */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureCreditAccount(ctx.user.id);
  const balance = await getCreditBalance(ctx.user.id);

  const admin = createSupabaseAdminClient();
  const { data: recent } = await admin
    .from("usage_events")
    .select(
      "request_id, purpose, model_id, provider, credits_charged, input_tokens, output_tokens, created_at"
    )
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    balance,
    recent: recent ?? [],
  });
}
