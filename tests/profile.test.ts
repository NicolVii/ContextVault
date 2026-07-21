import { describe, it, expect } from "vitest";
import { displayNameFromUser, needsOnboarding } from "../src/lib/profile";
import type { User } from "@supabase/supabase-js";

function fakeUser(
  overrides: Partial<User> & {
    email?: string;
    user_metadata?: Record<string, unknown>;
  }
): User {
  return {
    id: "user-1",
    aud: "authenticated",
    app_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
    user_metadata: overrides.user_metadata ?? {},
  } as User;
}

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

describe("displayNameFromUser", () => {
  it("prefers Google-style full_name metadata", () => {
    expect(
      displayNameFromUser(
        fakeUser({ email: "a@b.com", user_metadata: { full_name: "Viniv Vi" } })
      )
    ).toBe("Viniv Vi");
  });

  it("falls back to email local-part", () => {
    expect(
      displayNameFromUser(fakeUser({ email: "sam.rivera@example.com", user_metadata: {} }))
    ).toBe("sam.rivera");
  });
});
