import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import {
  BYOK_PROVIDERS,
  type ByokProvider,
} from "@/lib/billing/byok-providers";
import {
  deleteUserProviderKey,
  listUserProviderKeys,
  saveUserProviderKey,
} from "@/lib/billing/byok";
import { z } from "zod";

export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  provider: z.enum(BYOK_PROVIDERS),
  apiKey: z.string().trim().min(8).max(500),
  label: z.string().trim().max(80).optional().nullable(),
});

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = await listUserProviderKeys(ctx.user.id);
  return NextResponse.json({ keys });
}

export async function PUT(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await saveUserProviderKey({
    userId: ctx.user.id,
    provider: parsed.data.provider as ByokProvider,
    apiKey: parsed.data.apiKey,
    label: parsed.data.label,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") as ByokProvider | null;
  if (!provider || !BYOK_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  await deleteUserProviderKey(ctx.user.id, provider);
  return NextResponse.json({ ok: true });
}
