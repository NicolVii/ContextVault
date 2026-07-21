/**
 * Integration: Stripe webhook event claim uniqueness against local Supabase.
 * Skipped unless CV_INTEGRATION=1 (same gate as memory integration tests).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { claimStripeEvent } from "../src/lib/billing/webhook";

const run = process.env.CV_INTEGRATION === "1";

describe.runIf(run)("stripe webhook event claims (integration)", () => {
  beforeAll(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase env required for integration tests");
    }
  });

  it("claims an event once and treats retries as duplicates", async () => {
    const eventId = `evt_test_${crypto.randomUUID()}`;
    const first = await claimStripeEvent(eventId, "checkout.session.completed");
    const second = await claimStripeEvent(eventId, "checkout.session.completed");
    expect(first).toBe("claimed");
    expect(second).toBe("duplicate");

    // Cleanup
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await admin.from("stripe_webhook_events").delete().eq("event_id", eventId);
  });
});
