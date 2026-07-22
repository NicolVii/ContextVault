import { describe, expect, it } from "vitest";
import { PLAN_ENTITLEMENTS } from "../src/lib/billing/entitlements";
import {
  applyOverrideBonuses,
  countsAsPaidRevenue,
  demoBannerLabel,
  isOverrideActive,
  parseFeatureOverrides,
  pickActiveOverride,
  resolveEffectiveEntitlement,
  shouldShowDemoSubscriptionBanner,
  type EntitlementOverrideInput,
} from "../src/lib/billing/entitlement-resolution";

const NOW = new Date("2026-07-22T12:00:00.000Z");

function override(
  partial: Partial<EntitlementOverrideInput> &
    Pick<EntitlementOverrideInput, "id" | "planId">
): EntitlementOverrideInput {
  return {
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: "2026-08-01T00:00:00.000Z",
    autoTurnBonus: 0,
    frontierTurnBonus: 0,
    creditBonus: 0,
    storageBytesOverride: null,
    featureOverrides: {},
    reason: "test",
    createdBy: "admin-1",
    revokedAt: null,
    excludeFromRevenue: true,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...partial,
  };
}

describe("isOverrideActive", () => {
  it("rejects revoked, future, and expired rows", () => {
    expect(
      isOverrideActive(
        override({
          id: "1",
          planId: "pro",
          revokedAt: "2026-07-10T00:00:00.000Z",
        }),
        NOW
      )
    ).toBe(false);

    expect(
      isOverrideActive(
        override({
          id: "2",
          planId: "lite",
          startsAt: "2026-08-01T00:00:00.000Z",
        }),
        NOW
      )
    ).toBe(false);

    expect(
      isOverrideActive(
        override({
          id: "3",
          planId: "lite",
          endsAt: "2026-07-01T00:00:00.000Z",
        }),
        NOW
      )
    ).toBe(false);
  });

  it("accepts open-ended active windows", () => {
    expect(
      isOverrideActive(
        override({
          id: "4",
          planId: "free",
          endsAt: null,
        }),
        NOW
      )
    ).toBe(true);
  });
});

describe("pickActiveOverride", () => {
  it("prefers the newest created active row", () => {
    const picked = pickActiveOverride(
      [
        override({
          id: "old",
          planId: "lite",
          createdAt: "2026-07-01T00:00:00.000Z",
        }),
        override({
          id: "new",
          planId: "pro",
          createdAt: "2026-07-20T00:00:00.000Z",
        }),
        override({
          id: "expired",
          planId: "pro",
          endsAt: "2026-07-02T00:00:00.000Z",
          createdAt: "2026-07-21T00:00:00.000Z",
        }),
      ],
      NOW
    );
    expect(picked?.id).toBe("new");
    expect(picked?.planId).toBe("pro");
  });
});

describe("applyOverrideBonuses", () => {
  it("adds Auto and Frontier turn bonuses onto Free", () => {
    const ents = applyOverrideBonuses(PLAN_ENTITLEMENTS.free, {
      autoTurnBonus: 20,
      frontierTurnBonus: 5,
      storageBytesOverride: null,
      featureOverrides: {},
    });
    expect(ents.autoMonthlyTurns).toBe(50);
    expect(ents.frontierMonthlyTurns).toBe(5);
    expect(ents.unlimitedAuto).toBe(false);
  });

  it("keeps unlimited Auto when base is unlimited and applies storage/feature overrides", () => {
    const ents = applyOverrideBonuses(PLAN_ENTITLEMENTS.pro, {
      autoTurnBonus: 100,
      frontierTurnBonus: 10,
      storageBytesOverride: 50 * 1024 * 1024,
      featureOverrides: { byok: false, voice: true, attachments: true },
    });
    expect(ents.autoMonthlyTurns).toBeNull();
    expect(ents.unlimitedAuto).toBe(true);
    expect(ents.frontierMonthlyTurns).toBeNull();
    expect(ents.storageBytes).toBe(50 * 1024 * 1024);
    expect(ents.byok).toBe(false);
    expect(ents.voice).toBe(true);
  });
});

describe("resolveEffectiveEntitlement priority", () => {
  const paidSub = {
    planId: "pro",
    status: "active",
    currentPeriodEnd: "2026-08-15T00:00:00.000Z",
    cancelAtPeriodEnd: false,
  };

  it("falls back to Free with no rows", () => {
    const resolved = resolveEffectiveEntitlement({ now: NOW });
    expect(resolved.source).toBe("free");
    expect(resolved.planId).toBe("free");
    expect(resolved.isDemo).toBe(false);
    expect(countsAsPaidRevenue(resolved)).toBe(false);
    expect(shouldShowDemoSubscriptionBanner(resolved)).toBe(false);
  });

  it("uses real subscription when no admin override is active", () => {
    const resolved = resolveEffectiveEntitlement({
      now: NOW,
      subscription: paidSub,
    });
    expect(resolved.source).toBe("subscription");
    expect(resolved.planId).toBe("pro");
    expect(resolved.isDemo).toBe(false);
    expect(resolved.excludeFromRevenue).toBe(false);
    expect(countsAsPaidRevenue(resolved)).toBe(true);
    expect(resolved.entitlements.byok).toBe(true);
  });

  it("prefers admin grant over real subscription", () => {
    const resolved = resolveEffectiveEntitlement({
      now: NOW,
      grants: [
        override({
          id: "g1",
          planId: "lite",
          reason: "hosted demo",
          autoTurnBonus: 5,
          frontierTurnBonus: 2,
        }),
      ],
      subscription: paidSub,
    });
    expect(resolved.source).toBe("admin_grant");
    expect(resolved.planId).toBe("lite");
    expect(resolved.isDemo).toBe(true);
    expect(resolved.excludeFromRevenue).toBe(true);
    expect(countsAsPaidRevenue(resolved)).toBe(false);
    expect(shouldShowDemoSubscriptionBanner(resolved)).toBe(true);
    expect(resolved.entitlements.frontierMonthlyTurns).toBe(12);
    expect(demoBannerLabel(resolved)).toContain("Demo subscription");
  });

  it("prefers plan simulation over admin grant and subscription", () => {
    const resolved = resolveEffectiveEntitlement({
      now: NOW,
      simulations: [
        override({
          id: "s1",
          planId: "free",
          reason: "support reproduce",
          storageBytesOverride: 10_000,
          featureOverrides: { attachments: true },
        }),
      ],
      grants: [override({ id: "g1", planId: "pro" })],
      subscription: paidSub,
    });
    expect(resolved.source).toBe("plan_simulation");
    expect(resolved.planId).toBe("free");
    expect(resolved.entitlements.attachments).toBe(true);
    expect(resolved.entitlements.storageBytes).toBe(10_000);
    expect(countsAsPaidRevenue(resolved)).toBe(false);
    expect(demoBannerLabel(resolved)).toContain("Plan simulation");
  });

  it("ignores expired simulation and falls through to grant", () => {
    const resolved = resolveEffectiveEntitlement({
      now: NOW,
      simulations: [
        override({
          id: "s-expired",
          planId: "pro",
          endsAt: "2026-07-01T00:00:00.000Z",
        }),
      ],
      grants: [override({ id: "g-active", planId: "lite" })],
      subscription: paidSub,
    });
    expect(resolved.source).toBe("admin_grant");
    expect(resolved.planId).toBe("lite");
  });

  it("ignores future grant and uses subscription", () => {
    const resolved = resolveEffectiveEntitlement({
      now: NOW,
      grants: [
        override({
          id: "g-future",
          planId: "lite",
          startsAt: "2026-08-01T00:00:00.000Z",
        }),
      ],
      subscription: paidSub,
    });
    expect(resolved.source).toBe("subscription");
    expect(countsAsPaidRevenue(resolved)).toBe(true);
  });

  it("treats canceled paid subscription as Free", () => {
    const resolved = resolveEffectiveEntitlement({
      now: NOW,
      subscription: {
        planId: "pro",
        status: "canceled",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    });
    expect(resolved.source).toBe("free");
    expect(resolved.planId).toBe("free");
    expect(countsAsPaidRevenue(resolved)).toBe(false);
  });

  it("supports temporary Free assignment that still shows the demo banner", () => {
    const resolved = resolveEffectiveEntitlement({
      now: NOW,
      grants: [override({ id: "g-free", planId: "free" })],
      subscription: paidSub,
    });
    expect(resolved.planId).toBe("free");
    expect(resolved.source).toBe("admin_grant");
    expect(shouldShowDemoSubscriptionBanner(resolved)).toBe(true);
    expect(countsAsPaidRevenue(resolved)).toBe(false);
  });
});

describe("parseFeatureOverrides", () => {
  it("keeps only known boolean feature keys", () => {
    expect(
      parseFeatureOverrides({
        attachments: true,
        byok: false,
        unknown: true,
        voice: "yes",
      })
    ).toEqual({ attachments: true, byok: false });
  });
});

describe("demo revenue exclusion", () => {
  it("never counts grant or simulation Pro as paid revenue", () => {
    for (const source of ["admin_grant", "plan_simulation"] as const) {
      expect(
        countsAsPaidRevenue({
          source,
          planId: "pro",
          excludeFromRevenue: true,
        })
      ).toBe(false);
    }
  });
});
