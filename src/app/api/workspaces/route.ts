import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  default_model: z.string().min(1).default("auto"),
  monthly_credit_budget: z.number().int().positive().nullable().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  default_model: z.string().min(1).optional(),
  monthly_credit_budget: z.number().int().positive().nullable().optional(),
});

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.supabase
    .from("workspaces")
    .select("id, name, default_model, monthly_credit_budget, created_at")
    .eq("owner_id", ctx.user.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspaces: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("workspaces")
    .insert({
      owner_id: ctx.user.id,
      name: parsed.data.name,
      default_model: parsed.data.default_model,
      monthly_credit_budget: parsed.data.monthly_credit_budget ?? null,
    })
    .select("id, name, default_model, monthly_credit_budget")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await ctx.supabase.from("workspace_members").insert({
    workspace_id: data.id,
    user_id: ctx.user.id,
    role: "owner",
  });

  return NextResponse.json({ workspace: data });
}

export async function PATCH(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { id, ...fields } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("workspaces")
    .update(fields)
    .eq("id", id)
    .eq("owner_id", ctx.user.id)
    .select("id, name, default_model, monthly_credit_budget")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspace: data });
}

export async function DELETE(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await ctx.supabase
    .from("workspaces")
    .delete()
    .eq("id", id)
    .eq("owner_id", ctx.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
