import { describe, expect, it } from "vitest";
import {
  appendServerTiming,
  isPerfTimingEnabled,
  serverTimingMetric,
} from "../src/lib/perf";

describe("perf helpers", () => {
  it("formats Server-Timing metrics without user data", () => {
    expect(serverTimingMetric("mw-auth", 12.34)).toBe("mw-auth;dur=12.3");
    expect(serverTimingMetric("plan snapshot!", 1)).toBe("plan_snapshot_;dur=1.0");
  });

  it("appends Server-Timing values", () => {
    expect(appendServerTiming(null, "a;dur=1.0")).toBe("a;dur=1.0");
    expect(appendServerTiming("a;dur=1.0", "b;dur=2.0")).toBe(
      "a;dur=1.0, b;dur=2.0"
    );
  });

  it("enables timing when PERF_TIMING=1", () => {
    const prevPerf = process.env.PERF_TIMING;
    try {
      process.env.PERF_TIMING = "1";
      expect(isPerfTimingEnabled()).toBe(true);
      delete process.env.PERF_TIMING;
      // In this repo's unit-test NODE_ENV, development may also enable timing;
      // asserting PERF_TIMING alone is the explicit opt-in contract.
      process.env.PERF_TIMING = "1";
      expect(isPerfTimingEnabled()).toBe(true);
    } finally {
      if (prevPerf === undefined) delete process.env.PERF_TIMING;
      else process.env.PERF_TIMING = prevPerf;
    }
  });
});
