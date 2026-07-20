import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  vecFor,
  type TestUser,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createTestUser();
  bob = await createTestUser();
});

afterAll(async () => {
  if (alice) await deleteTestUser(alice.id).catch(() => {});
  if (bob) await deleteTestUser(bob.id).catch(() => {});
});

describe("authentication", () => {
  it("creates a profile automatically and lets the user read it", async () => {
    const { data, error } = await alice.client
      .from("profiles")
      .select("*")
      .eq("id", alice.id)
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBe(alice.id);
  });
});

describe("memory isolation (RLS)", () => {
  let aliceMemoryId: string;

  it("lets a user create and read their own memory", async () => {
    const { data, error } = await alice.client
      .from("memories")
      .insert({
        user_id: alice.id,
        content: "Alice secret: I love hiking in the mountains",
        type: "semantic",
        source: "manual",
        embedding: await vecFor("Alice secret: I love hiking in the mountains"),
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(alice.id);
    aliceMemoryId = data!.id;
  });

  it("prevents another user from reading it", async () => {
    const { data } = await bob.client
      .from("memories")
      .select("*")
      .eq("id", aliceMemoryId);
    expect(data ?? []).toHaveLength(0);
  });

  it("prevents another user from updating or deleting it", async () => {
    await bob.client.from("memories").update({ content: "hacked" }).eq("id", aliceMemoryId);
    await bob.client.from("memories").delete().eq("id", aliceMemoryId);
    // Verify via admin that the row is untouched.
    const admin = adminClient();
    const { data } = await admin.from("memories").select("content").eq("id", aliceMemoryId).single();
    expect(data?.content).toContain("Alice secret");
  });

  it("blocks an unauthenticated client from reading memories", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await anon.from("memories").select("*").eq("id", aliceMemoryId);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("semantic retrieval", () => {
  beforeAll(async () => {
    await alice.client.from("memories").insert({
      user_id: alice.id,
      content: "I prefer to travel by train rather than flying",
      type: "preference",
      source: "manual",
      status: "active",
      embedding: await vecFor("I prefer to travel by train rather than flying"),
    });
  });

  it("returns the user's own relevant memory", async () => {
    const { data, error } = await alice.client.rpc("match_memories", {
      query_embedding: await vecFor("train travel preference"),
      match_count: 5,
      filter_types: null,
    });
    expect(error).toBeNull();
    const contents = (data ?? []).map((m: { content: string }) => m.content);
    expect(contents.some((c: string) => c.includes("travel by train"))).toBe(true);
  });

  it("never returns another user's memory from retrieval", async () => {
    const { data } = await bob.client.rpc("match_memories", {
      query_embedding: await vecFor("train travel preference"),
      match_count: 5,
      filter_types: null,
    });
    const contents = (data ?? []).map((m: { content: string }) => m.content);
    expect(contents.some((c: string) => c.includes("travel by train"))).toBe(false);
  });
});

describe("deletion", () => {
  it("permanently deletes a memory the user owns", async () => {
    const { data: created } = await alice.client
      .from("memories")
      .insert({
        user_id: alice.id,
        content: "temporary note to delete",
        type: "temporary",
        source: "manual",
        embedding: await vecFor("temporary note to delete"),
      })
      .select()
      .single();

    await alice.client.from("memories").delete().eq("id", created!.id);

    const { data } = await alice.client.from("memories").select("*").eq("id", created!.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("cascades deletion of all memories when the account is deleted", async () => {
    const doomed = await createTestUser();
    await doomed.client.from("memories").insert({
      user_id: doomed.id,
      content: "should be gone after account deletion",
      type: "semantic",
      source: "manual",
      embedding: await vecFor("should be gone after account deletion"),
    });

    await deleteTestUser(doomed.id);

    const admin = adminClient();
    const { data } = await admin.from("memories").select("id").eq("user_id", doomed.id);
    expect(data ?? []).toHaveLength(0);
  });
});
