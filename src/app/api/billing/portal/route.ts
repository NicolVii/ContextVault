import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getStripe, getOrCreateStripeCustomer, appBaseUrl } from "@/lib/billing/stripe";
import { assertPortalAllowed } from "@/lib/billing/commercial";
import {
  assertMaintenanceAllowed,
  OperationalControlError,
  operationalControlErrorResponse,
} from "@/lib/admin/system-controls";

export const dynamic = "force-dynamic";

/** Stripe Customer Portal for managing subscriptions / payment methods. */
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

  const gate = assertPortalAllowed();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, code: gate.code },
      { status: gate.status }
    );
  }

  const stripe = getStripe()!;
  const customerId = await getOrCreateStripeCustomer({
    userId: ctx.user.id,
    email: ctx.user.email,
  });
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl(request)}/vault/plan`,
  });
  return NextResponse.json({ url: session.url });
}
