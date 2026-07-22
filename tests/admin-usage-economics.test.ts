import { describe, expect, it } from "vitest";
import {
  aggregateUsageEconomics,
  formatBytes,
  formatUsdMicros,
  percentile,
  resolveUsageFilters,
  ILLUSTRATIVE_USD_TO_EUR,
  type UsageEventAggRow,
} from "../src/lib/admin/usage-economics";

function event(
  overrides: Partial<UsageEventAggRow> & { user_id: string }
): UsageEventAggRow {
  return {
    model_id: "openai.gpt-4o-mini",
    provider: "openrouter",
    billing_mode: "platform",
    input_tokens: 100,
    output_tokens: 50,
    total_tokens: 150,
    provider_cost_usd_micros: 1_000,
    latency_ms: 200,
    failover_count: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveUsageFilters", () => {
  it("defaults to a 30-day window", () => {
    const f = resolveUsageFilters({});
    expect(f.days).toBe(30);
    expect(f.intensity).toBe("all");
    expect(f.billingMode).toBe("all");
    expect(f.audience).toBe("all");
    expect(f.planId).toBeNull();
  });

  it("accepts facet filters", () => {
    const f = resolveUsageFilters({
      days: 7,
      planId: "pro",
      provider: "openai",
      modelId: "openai.gpt-4o",
      intensity: "frontier",
      billingMode: "byok",
      audience: "real",
    });
    expect(f.days).toBe(7);
    expect(f.planId).toBe("pro");
    expect(f.provider).toBe("openai");
    expect(f.modelId).toBe("openai.gpt-4o");
    expect(f.intensity).toBe("frontier");
    expect(f.billingMode).toBe("byok");
    expect(f.audience).toBe("real");
  });

  it("clamps days to 1–365", () => {
    expect(resolveUsageFilters({ days: 0 }).days).toBe(1);
    expect(resolveUsageFilters({ days: 999 }).days).toBe(365);
  });
});

describe("percentile / format helpers", () => {
  it("computes percentiles on sorted samples", () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([10], 0.5)).toBe(10);
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
  });

  it("formats usd micros and bytes", () => {
    expect(formatUsdMicros(0)).toBe("$0");
    expect(formatUsdMicros(5_000)).toBe("<$0.01");
    expect(formatUsdMicros(1_500_000)).toBe("$1.50");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(2048)).toBe("2 KB");
  });
});

describe("aggregateUsageEconomics", () => {
  const filters = resolveUsageFilters({ days: 30 });

  it("aggregates turns, tokens, costs, and excludes demo when audience=real", () => {
    const demoIds = new Set(["demo-user"]);
    const planByUser = new Map([
      ["u1", "pro"],
      ["u2", "lite"],
      ["demo-user", "pro"],
    ]);

    const stats = aggregateUsageEconomics({
      filters: { ...filters, audience: "real" },
      events: [
        event({ user_id: "u1", provider_cost_usd_micros: 2_000_000 }),
        event({
          user_id: "u2",
          model_id: "anthropic.claude-3.5-sonnet",
          provider_cost_usd_micros: 500_000,
          input_tokens: 400,
          output_tokens: 100,
          total_tokens: 500,
          latency_ms: 400,
        }),
        event({
          user_id: "demo-user",
          provider_cost_usd_micros: 9_000_000,
        }),
        event({
          user_id: "u1",
          billing_mode: "byok",
          provider_cost_usd_micros: 3_000_000,
        }),
      ],
      truncated: false,
      opsEvents: [
        { provider: "openrouter", outcome: "success", latency_ms: 100 },
        { provider: "openrouter", outcome: "failure", latency_ms: null },
        { provider: "openrouter", outcome: "failover", latency_ms: null },
        { provider: "mock", outcome: "mock_fallback", latency_ms: 5 },
      ],
      planByUser,
      demoUserIds: demoIds,
      registrations: 4,
      usersByPlan: new Map([
        ["pro", 2],
        ["lite", 1],
      ]),
      memory: { created: 3, active: 2, proposed: 1 },
      documents: { created: 5, ready: 4, processing: 0, failed: 1 },
      storage: { totalBytes: 1024, documentCount: 5 },
      paidSubsByPlan: new Map([
        ["pro", 1],
        ["lite", 1],
      ]),
    });

    expect(stats.users.activeUsers).toBe(2);
    expect(stats.users.registrations).toBe(4);
    expect(stats.turns.auto).toBeGreaterThan(0);
    expect(stats.turns.frontier).toBeGreaterThan(0);
    expect(stats.economics.estimatedProviderCostUsdMicros).toBe(2_500_000);
    expect(stats.economics.byokCostAvoidedUsdMicros).toBe(3_000_000);
    expect(stats.economics.estimatedRevenueEurCents).toBe(2_800 + 500);
    expect(stats.reliability.errors).toBe(1);
    expect(stats.reliability.failovers).toBe(1);
    expect(stats.reliability.mockFallback).toBe(1);
    expect(stats.economics.disclaimer.toLowerCase()).toContain("estimated");
    expect(stats.economics.disclaimer.toLowerCase()).toContain("stripe");

    const expectedMargin =
      2_800 +
      500 -
      Math.round((2_500_000 / 1_000_000) * ILLUSTRATIVE_USD_TO_EUR * 100);
    expect(stats.economics.estimatedGrossMarginEurCents).toBe(expectedMargin);
  });

  it("filters by plan, provider, intensity, and billing mode", () => {
    const planByUser = new Map([
      ["u1", "pro"],
      ["u2", "lite"],
    ]);
    const stats = aggregateUsageEconomics({
      filters: {
        ...filters,
        planId: "pro",
        provider: "openrouter",
        intensity: "auto",
        billingMode: "platform",
      },
      events: [
        event({ user_id: "u1" }),
        event({
          user_id: "u1",
          model_id: "anthropic.claude-3.5-sonnet",
        }),
        event({ user_id: "u2" }),
        event({ user_id: "u1", provider: "openai" }),
        event({ user_id: "u1", billing_mode: "byok" }),
      ],
      truncated: false,
      opsEvents: [],
      planByUser,
      demoUserIds: new Set(),
      registrations: 0,
      usersByPlan: new Map([["pro", 1]]),
      memory: { created: 0, active: 0, proposed: 0 },
      documents: { created: 0, ready: 0, processing: 0, failed: 0 },
      storage: { totalBytes: 0, documentCount: 0 },
      paidSubsByPlan: new Map(),
    });

    expect(stats.turns.total).toBe(1);
    expect(stats.turns.auto).toBe(1);
    expect(stats.turns.frontier).toBe(0);
    expect(stats.providers).toHaveLength(1);
    expect(stats.providers[0]?.key).toBe("openrouter");
  });

  it("never returns raw events — only summary shapes", () => {
    const stats = aggregateUsageEconomics({
      filters,
      events: [event({ user_id: "u1" })],
      truncated: true,
      opsEvents: [],
      planByUser: new Map([["u1", "free"]]),
      demoUserIds: new Set(),
      registrations: 1,
      usersByPlan: new Map([["free", 1]]),
      memory: { created: 0, active: 0, proposed: 0 },
      documents: { created: 0, ready: 0, processing: 0, failed: 0 },
      storage: { totalBytes: 0, documentCount: 0 },
      paidSubsByPlan: new Map(),
    });

    expect(stats.meta.usageEventsTruncated).toBe(true);
    expect(stats).not.toHaveProperty("events");
    expect(JSON.stringify(stats)).not.toContain("request_id");
  });
});
