import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Mem0Client } from "../src/lib/memory/mem0/client";
import {
  getMemoryProvider,
  readMem0ApiKey,
  resetMemoryProviderCache,
} from "../src/lib/memory";

describe("Mem0Client", () => {
  it("queues an add, polls the event, and returns the created memory id", async () => {
    const mem0Id = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    const fetchImpl = viFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          message: "queued",
          status: "PENDING",
          event_id: "evt-1",
        }),
      },
      {
        ok: true,
        status: 200,
        json: async () => ({
          status: "SUCCEEDED",
          results: [{ id: mem0Id }],
        }),
      },
    ]) as ReturnType<typeof vi.fn>;

    const client = new Mem0Client({
      apiKey: "test-key",
      baseUrl: "https://mem0.test",
      pollIntervalMs: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const id = await client.addMemory({
      userId: "user-1",
      content: "I prefer dark mode",
      metadata: {
        cv_memory_id: "cv-1",
        type: "preference",
        source: "manual",
        status: "active",
      },
    });

    expect(id).toBe(mem0Id);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [addUrl, addInit] = fetchImpl.mock.calls[0];
    expect(addUrl).toBe("https://mem0.test/v3/memories/add/");
    expect(addInit?.method).toBe("POST");
    expect(JSON.parse(String(addInit?.body))).toMatchObject({
      user_id: "user-1",
      infer: false,
      messages: [{ role: "user", content: "I prefer dark mode" }],
    });
  });

  it("searches memories with filters scoped to the user", async () => {
    const fetchImpl = viFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: "mem0-1",
              memory: "Likes hiking",
              score: 0.91,
              metadata: { cv_memory_id: "cv-1", type: "semantic", source: "manual" },
            },
          ],
        }),
      },
    ]) as ReturnType<typeof vi.fn>;

    const client = new Mem0Client({
      apiKey: "test-key",
      baseUrl: "https://mem0.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const results = await client.searchMemories({
      userId: "user-1",
      query: "outdoor hobbies",
      topK: 5,
    });

    expect(results).toHaveLength(1);
    const [, searchInit] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(searchInit?.body))).toMatchObject({
      query: "outdoor hobbies",
      filters: { user_id: "user-1" },
      top_k: 5,
    });
  });

  it("deletes a single memory and ignores 404 when requested", async () => {
    const fetchImpl = viFetchSequence([
      { ok: false, status: 404, json: async () => ({ detail: "not found" }) },
    ]) as ReturnType<typeof vi.fn>;

    const client = new Mem0Client({
      apiKey: "test-key",
      baseUrl: "https://mem0.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.deleteMemory("missing-id", { ignoreNotFound: true })
    ).resolves.toBeUndefined();
  });

  it("deletes all memories for a user", async () => {
    const fetchImpl = viFetchSequence([
      { ok: true, status: 200, json: async () => ({}) },
    ]) as ReturnType<typeof vi.fn>;

    const client = new Mem0Client({
      apiKey: "test-key",
      baseUrl: "https://mem0.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.deleteAllForUser("user-1");
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://mem0.test/v1/memories/?user_id=user-1"
    );
  });
});

describe("readMem0ApiKey", () => {
  it("trims whitespace and surrounding quotes", () => {
    expect(readMem0ApiKey({ MEM0_API_KEY: "  m0-test  " })).toBe("m0-test");
    expect(readMem0ApiKey({ MEM0_API_KEY: '"m0-test"' })).toBe("m0-test");
    expect(readMem0ApiKey({ MEM0_API_KEY: "   " })).toBeNull();
    expect(readMem0ApiKey({})).toBeNull();
  });
});

describe("getMemoryProvider", () => {
  beforeEach(() => {
    resetMemoryProviderCache();
  });

  afterEach(() => {
    delete process.env.MEMORY_PROVIDER;
    delete process.env.MEM0_API_KEY;
    resetMemoryProviderCache();
  });

  it("selects the Mem0 provider when configured", () => {
    process.env.MEMORY_PROVIDER = "mem0";
    process.env.MEM0_API_KEY = "test-key";
    expect(getMemoryProvider().name).toBe("mem0");
  });

  it("falls back to Supabase when Mem0 is not configured", () => {
    process.env.MEMORY_PROVIDER = "mem0";
    delete process.env.MEM0_API_KEY;
    expect(getMemoryProvider().name).toBe("supabase");
  });
});

function viFetchSequence(
  responses: Array<{ ok: boolean; status: number; json: () => Promise<unknown>; text?: () => Promise<string> }>
) {
  const fetchImpl = vi.fn();
  for (const response of responses) {
    fetchImpl.mockResolvedValueOnce({
      ok: response.ok,
      status: response.status,
      text: response.text ?? (async () => JSON.stringify(await response.json())),
      json: response.json,
    });
  }
  return fetchImpl;
}
