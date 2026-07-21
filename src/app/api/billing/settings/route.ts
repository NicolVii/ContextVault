import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  monthlySpendCapEurCents: z.number().int().min(0).nullable().optional(),
  autoTopupEnabled: z.boolean().optional(),
  autoTopupPackId: z.string().nullable().optional(),
});

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("billing_settings")
    .select(
      "monthly_spend_cap_eur_cents, auto_topup_enabled, auto_topup_pack_id, grace_period_ends_at, inference_restricted"
    )
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  return NextResponse.json({
    monthlySpendCapEurCents: data?.monthly_spend_cap_eur_cents ?? null,
    autoTopupEnabled: Boolean(data?.auto_topup_enabled),
    autoTopupPackId: data?.auto_topup_pack_id ?? null,
    gracePeriodEndsAt: data?.grace_period_ends_at ?? null,
    inferenceRestricted: Boolean(data?.inference_restricted),
  });
}

export async function PATCH(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const row = {
    user_id: ctx.user.id,
    monthly_spend_cap_eur_cents:
      parsed.data.monthlySpendCapEurCents === undefined
        ? undefined
        : parsed.data.monthlySpendCapEurCents,
    auto_topup_enabled: parsed.data.autoTopupEnabled,
    auto_topup_pack_id:
      parsed.data.autoTopupPackId === undefined
        ? undefined
        : parsed.data.autoTopupPackId,
    updated_at: new Date().toISOString(),
  };

  // Strip undefined so upsert does not null out untouched fields incorrectly.
  const payload = Object.fromEntries(
    Object.entries(row).filter(([, v]) => v !== undefined)
  );

  const { error } = await admin.from("billing_settings").upsert(payload, {
    onConflict: "user_id",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
