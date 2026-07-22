import { describe, expect, it } from "vitest";
import {
  evaluateControlActive,
  isModelShutDown,
  isOperationalControlKey,
  isProviderShutDown,
  OPERATIONAL_CONTROL_KEYS,
  OPERATIONAL_CONTROL_META,
  type OperationalControlKey,
  type OperationalControlState,
  type OperationalControlsSnapshot,
} from "@/lib/admin/system-controls";

function snapWith(
  overrides: Partial<Record<OperationalControlKey, Partial<OperationalControlState>>>
): OperationalControlsSnapshot {
  const controls = new Map<OperationalControlKey, OperationalControlState>();
  for (const key of OPERATIONAL_CONTROL_KEYS) {
    const base: OperationalControlState = {
      key,
      enabled: false,
      active: false,
      expiresAt: null,
      reason: null,
      targetIds: [],
      updatedAt: null,
      updatedBy: null,
      metadata: {},
    };
    const over = overrides[key];
    if (over) {
      const enabled = over.enabled ?? base.enabled;
      const expiresAt = over.expiresAt ?? base.expiresAt;
      controls.set(key, {
        ...base,
        ...over,
        enabled,
        expiresAt,
        active: evaluateControlActive(enabled, expiresAt),
        targetIds: over.targetIds ?? base.targetIds,
      });
    } else {
      controls.set(key, base);
    }
  }
  return { controls, loadedAt: Date.now() };
}

describe("operational control keys", () => {
  it("covers the documented kill-switches", () => {
    expect(OPERATIONAL_CONTROL_KEYS).toEqual([
      "maintenance_mode",
      "mock_only_mode",
      "frontier_shutdown",
      "file_upload_shutdown",
      "voice_shutdown",
      "registration_shutdown",
      "checkout_shutdown",
      "provider_shutdown",
      "model_shutdown",
    ]);
    for (const key of OPERATIONAL_CONTROL_KEYS) {
      expect(OPERATIONAL_CONTROL_META[key].label.length).toBeGreaterThan(0);
      expect(isOperationalControlKey(key)).toBe(true);
    }
    expect(isOperationalControlKey("nope")).toBe(false);
  });
});

describe("evaluateControlActive", () => {
  it("treats disabled controls as inactive", () => {
    expect(evaluateControlActive(false, null)).toBe(false);
    expect(evaluateControlActive(false, "2099-01-01T00:00:00.000Z")).toBe(false);
  });

  it("treats enabled without expiry as active", () => {
    expect(evaluateControlActive(true, null)).toBe(true);
  });

  it("honors future and past expiry", () => {
    const now = Date.parse("2026-07-22T12:00:00.000Z");
    expect(
      evaluateControlActive(true, "2026-07-22T13:00:00.000Z", now)
    ).toBe(true);
    expect(
      evaluateControlActive(true, "2026-07-22T11:00:00.000Z", now)
    ).toBe(false);
  });
});

describe("provider and model shutdown targeting", () => {
  it("shuts down all non-mock providers when targets empty", () => {
    const snap = snapWith({
      provider_shutdown: { enabled: true, active: true, targetIds: [] },
    });
    expect(isProviderShutDown("openai", snap)).toBe(true);
    expect(isProviderShutDown("anthropic", snap)).toBe(true);
    expect(isProviderShutDown("mock", snap)).toBe(false);
  });

  it("only shuts down listed providers when targets set", () => {
    const snap = snapWith({
      provider_shutdown: {
        enabled: true,
        active: true,
        targetIds: ["openai"],
      },
    });
    expect(isProviderShutDown("openai", snap)).toBe(true);
    expect(isProviderShutDown("anthropic", snap)).toBe(false);
  });

  it("shuts down all models when targets empty", () => {
    const snap = snapWith({
      model_shutdown: { enabled: true, active: true, targetIds: [] },
    });
    expect(isModelShutDown("openai.gpt-4o-mini", snap)).toBe(true);
  });

  it("ignores inactive provider shutdown", () => {
    const snap = snapWith({
      provider_shutdown: {
        enabled: true,
        expiresAt: "2000-01-01T00:00:00.000Z",
        targetIds: [],
      },
    });
    expect(isProviderShutDown("openai", snap)).toBe(false);
  });
});
