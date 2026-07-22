import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { chatRequestSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { isValidSelection } from "@/lib/inference/models";
import { InsufficientCreditsError } from "@/lib/inference/credits";
import { PlanUsageBlockedError } from "@/lib/billing/plan-usage";
import {
  assertMaintenanceAllowed,
  OperationalControlError,
  operationalControlErrorResponse,
} from "@/lib/admin/system-controls";
import { runChatOrchestrator } from "@/lib/orchestration/chat";

/** Always resolve identity fresh — never serve a cached chat handler. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await assertMaintenanceAllowed();
  } catch (err) {
    if (err instanceof OperationalControlError) {
      return NextResponse.json(operationalControlErrorResponse(err), {
        status: err.status,
      });
    }
    throw err;
  }

  const limit = await checkRateLimit(ctx.user.id, "chat", 30, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const selectionRaw = parsed.data.selection ?? parsed.data.model;
  if (!selectionRaw || !isValidSelection(selectionRaw)) {
    return NextResponse.json({ error: "Unknown model or selection" }, { status: 400 });
  }

  try {
    const result = await runChatOrchestrator({
      user: ctx.user,
      supabase: ctx.supabase,
      message: parsed.data.message,
      selectionRaw,
      sessionId: parsed.data.sessionId,
    });

    return NextResponse.json({
      sessionId: result.sessionId,
      message: result.message,
      usedMemories: result.usedMemories,
      usedChunks: result.usedChunks,
      usedIdentity: result.usedIdentity,
      identityDirectAnswer: result.identityDirectAnswer,
      proposedCount: result.proposedCount,
      mocked: result.mocked,
      resolved: result.resolved,
      selection: result.selection,
    });
  } catch (err) {
    if (err instanceof OperationalControlError) {
      return NextResponse.json(operationalControlErrorResponse(err), {
        status: err.status,
      });
    }
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: err.message,
          code: "insufficient_credits",
          balance: err.balance,
          required: err.required,
        },
        { status: 402 }
      );
    }
    if (err instanceof PlanUsageBlockedError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Model request failed" },
      { status: 502 }
    );
  }
}
