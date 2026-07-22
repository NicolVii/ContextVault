import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  isProviderConfigured,
  listProviderAdminViews,
  loadProviderOpsSnapshot,
  updateProviderConfig,
  updateModelOverride,
  invalidateProviderOpsCache,
} from "../src/lib/inference/provider-ops";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ready = Boolean(url && anon && service && process.env.CV_INTEGRATION === "1");

describe.skipIf(!ready)("provider ops integration", () => {
  beforeAll(() => {
    invalidateProviderOpsCache();
  });

  it("loads seeded provider and model config via service role", async () => {
    const snap = await loadProviderOpsSnapshot();
    expect(snap.providers.get("openrouter")?.enabled).toBe(true);
    expect(snap.models.get("openai.gpt-4o-mini")?.autoEligible).toBe(true);
    expect(snap.models.get("anthropic.claude-3.5-sonnet")?.frontierEligible).toBe(
      true
    );
  });

  it("lists admin views without any key-like fields", async () => {
    const { providers, models } = await listProviderAdminViews({
      windowDays: 7,
    });
    expect(providers.length).toBeGreaterThanOrEqual(6);
    expect(models.length).toBeGreaterThanOrEqual(5);

    const blob = JSON.stringify({ providers, models });
    expect(blob).not.toMatch(/sk-/i);
    expect(blob).not.toMatch(/api[_-]?key/i);
    expect(blob).not.toMatch(/ciphertext/i);
    expect(blob).not.toMatch(/OPENROUTER_API_KEY/i);

    for (const p of providers) {
      expect(typeof p.configured).toBe("boolean");
      expect(typeof p.enabled).toBe("boolean");
      expect(typeof p.fallbackPriority).toBe("number");
      expect(Array.isArray(p.supportedModels)).toBe(true);
      expect(p.metrics).toBeDefined();
    }
  });

  it("denies authenticated client reads on ops tables (RLS)", async () => {
    const userClient = createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `provider-ops-${Date.now()}@example.com`;
    const password = "provider-ops-test-password";
    const { data: created, error: createErr } =
      await userClient.auth.signUp({ email, password });
    expect(createErr).toBeNull();
    expect(created.user?.id).toBeTruthy();

    const { data: sessionData, error: signErr } =
      await userClient.auth.signInWithPassword({ email, password });
    expect(signErr).toBeNull();
    expect(sessionData.session).toBeTruthy();

    const { data: providers, error: pErr } = await userClient
      .from("inference_providers")
      .select("*");
    // RLS: no policies for authenticated → empty or error, never rows.
    expect(pErr || (providers ?? []).length === 0).toBeTruthy();
    expect((providers ?? []).length).toBe(0);

    const { data: overrides, error: oErr } = await userClient
      .from("inference_model_overrides")
      .select("*");
    expect(oErr || (overrides ?? []).length === 0).toBeTruthy();
    expect((overrides ?? []).length).toBe(0);
  });

  it("updates provider and model overrides with audit-safe patches", async () => {
    const admin = createClient(url!, service!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 50 });
    const actor =
      list?.users?.find((u) => u.email === "admin@contextvault.local")?.id ??
      list?.users?.[0]?.id;
    expect(actor).toBeTruthy();

    expect(isProviderConfigured("mock")).toBe(true);

    const provider = await updateProviderConfig({
      providerId: "groq",
      patch: { fallbackPriority: 77, enabled: true },
      actorUserId: actor!,
      reason: "integration test priority bump",
    });
    expect(provider.fallbackPriority).toBe(77);

    const model = await updateModelOverride({
      modelId: "openai.gpt-4o-mini",
      patch: { autoEligible: true, frontierEligible: false },
      actorUserId: actor!,
      reason: "integration test model eligibility",
    });
    expect(model.autoEligible).toBe(true);
    expect(model.frontierEligible).toBe(false);

    await updateProviderConfig({
      providerId: "groq",
      patch: { fallbackPriority: 50 },
      actorUserId: actor!,
      reason: "integration test restore",
    });
  });
});
