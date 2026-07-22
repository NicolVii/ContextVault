import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";
import { assertIntegrationEnv } from "./setup-env";
import { setUserRole } from "../src/lib/admin/auth";
import { ensureFreeSubscription } from "../src/lib/billing/ensure-free";
import { getPlanUsageSnapshot } from "../src/lib/billing/plan-usage";
import { getCreditBalance } from "../src/lib/inference/credits";
import {
  createPromotion,
  pausePromotion,
  redeemPromotion,
  resumePromotion,
  revokeRedemption,
} from "../src/lib/billing/promotions";

let subject: TestUser;
let actor: TestUser;

beforeAll(async () => {
  assertIntegrationEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`health status ${res.status}`);
  } catch (err) {
    throw new Error(
      [
        `Supabase is not reachable at ${url}.`,
        "Start the local stack with `pnpm db:start` (Docker required), then re-run.",
        `Cause: ${err instanceof Error ? err.message : String(err)}`,
      ].join("\n")
    );
  }

  subject = await createTestUser();
  actor = await createTestUser();
  await setUserRole(actor.id, "admin");
  await ensureFreeSubscription(subject.id);
});

afterAll(async () => {
  if (subject) await deleteTestUser(subject.id).catch(() => {});
  if (actor) await deleteTestUser(actor.id).catch(() => {});
});

describe("promotions system (integration)", () => {
  it("blocks authenticated clients from writing promotions", async () => {
    const insert = await subject.client.from("promotions").insert({
      slug: "should-fail",
      name: "Should fail",
      status: "active",
      distribution: "public_code",
      code: "FAILCODE",
      starts_at: new Date().toISOString(),
      reason: "should fail",
      bonus_effect: { frontierTurnBonus: 1 },
    });
    expect(insert.error).not.toBeNull();
  });

  it("creates a demo-simulated price promo and redeems usage bonuses", async () => {
    const startsAt = new Date(Date.now() - 60_000).toISOString();
    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const suffix = Date.now().toString(36);

    const promo = await createPromotion({
      actorUserId: actor.id,
      activate: true,
      input: {
        slug: `frontier-boost-${suffix}`,
        name: "Frontier boost",
        distribution: "public_code",
        code: `FB${suffix}`.toUpperCase().slice(0, 20),
        startsAt,
        endsAt,
        maxRedemptions: 10,
        maxRedemptionsPerUser: 1,
        eligiblePlans: [],
        audience: "all",
        priceEffect: {
          type: "percentage",
          percentOff: 15,
          duration: "once",
        },
        bonusEffect: {
          frontierTurnBonus: 12,
          creditBonus: 100,
          storageBytesBonus: 1_000_000,
          durationDays: 14,
        },
        reason: "integration test campaign",
      },
    });

    expect(promo.status).toBe("active");
    expect(promo.stripeCouponId).toBeNull();
    expect(promo.demoStripeSimulation?.simulated).toBe(true);

    const { data: audit } = await adminClient()
      .from("admin_audit_log")
      .select("action")
      .eq("target_id", promo.id)
      .eq("action", "admin.promotion.create")
      .maybeSingle();
    expect(audit?.action).toBe("admin.promotion.create");

    const beforeCredits = await getCreditBalance(subject.id);
    const beforeSnap = await getPlanUsageSnapshot(subject.id);

    const result = await redeemPromotion({
      code: promo.code!,
      userId: subject.id,
      source: "code",
    });

    expect(result.demoSimulated).toBe(true);
    expect(result.redemption.status).toBe("applied");
    expect(result.redemption.stripeCouponId).toBeNull();

    const afterCredits = await getCreditBalance(subject.id);
    expect(afterCredits).toBe(beforeCredits + 100);

    const afterSnap = await getPlanUsageSnapshot(subject.id);
    expect(afterSnap.isDemo).toBe(false);
    expect(afterSnap.entitlements.frontierMonthlyTurns).toBe(
      (beforeSnap.entitlements.frontierMonthlyTurns ?? 0) + 12
    );
    expect(afterSnap.entitlements.storageBytes).toBe(
      beforeSnap.entitlements.storageBytes + 1_000_000
    );

    await expect(
      redeemPromotion({
        code: promo.code!,
        userId: subject.id,
        source: "code",
      })
    ).rejects.toThrow(/already redeemed/i);

    const paused = await pausePromotion({
      id: promo.id,
      reason: "pause for test",
      actorUserId: actor.id,
    });
    expect(paused.status).toBe("paused");
    expect(paused.pausedAt).not.toBeNull();

    const other = await createTestUser();
    try {
      await ensureFreeSubscription(other.id);
      await expect(
        redeemPromotion({
          code: promo.code!,
          userId: other.id,
          source: "code",
        })
      ).rejects.toThrow(/paused/i);

      const resumed = await resumePromotion({
        id: promo.id,
        reason: "resume for test",
        actorUserId: actor.id,
      });
      expect(resumed.status).toBe("active");

      const otherRedeem = await redeemPromotion({
        code: promo.code!,
        userId: other.id,
        source: "code",
      });
      expect(otherRedeem.redemption.status).toBe("applied");

      const revoked = await revokeRedemption({
        redemptionId: otherRedeem.redemption.id,
        reason: "revoke test redemption",
        actorUserId: actor.id,
      });
      expect(revoked.status).toBe("revoked");
    } finally {
      await deleteTestUser(other.id).catch(() => {});
    }
  });
});
