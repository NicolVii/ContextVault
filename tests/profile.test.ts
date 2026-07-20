import { describe, it, expect } from "vitest";
import { needsOnboarding } from "../src/lib/profile";

describe("needsOnboarding", () => {
  it("requires onboarding when the profile row is missing", () => {
    expect(needsOnboarding(null)).toBe(true);
  });

  it("requires onboarding when onboarding_completed is false", () => {
    expect(needsOnboarding({ onboarding_completed: false })).toBe(true);
  });

  it("skips onboarding when completed", () => {
    expect(needsOnboarding({ onboarding_completed: true })).toBe(false);
  });
});
