import { describe, it, expect } from "vitest";
import {
  PERSONA_PROMPT_MAX,
  buildSystemPrompt,
  toUserIdentity,
} from "../src/lib/ai/context";
import type { RetrievedMemory } from "../src/lib/types";

function memory(overrides: Partial<RetrievedMemory> & { content: string }): RetrievedMemory {
  return {
    id: overrides.id ?? "mem-1",
    content: overrides.content,
    category: overrides.category ?? "About me",
    type: overrides.type ?? "profile",
    source: overrides.source ?? "manual",
    source_detail: overrides.source_detail ?? null,
    confidence: overrides.confidence ?? 1,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
    similarity: overrides.similarity ?? 1,
  };
}

describe("toUserIdentity", () => {
  it("includes display_name as Name", () => {
    expect(toUserIdentity({ display_name: "Alex Rivera", persona: null })).toEqual({
      displayName: "Alex Rivera",
    });
  });

  it("includes persona", () => {
    expect(toUserIdentity({ display_name: null, persona: "Concise engineer" })).toEqual({
      persona: "Concise engineer",
    });
  });

  it("omits null and blank profile fields", () => {
    expect(toUserIdentity({ display_name: null, persona: null })).toEqual({});
    expect(toUserIdentity({ display_name: "   ", persona: "\n\t" })).toEqual({});
    expect(toUserIdentity(null)).toEqual({});
    expect(toUserIdentity(undefined)).toEqual({});
  });

  it("truncates long persona to PERSONA_PROMPT_MAX", () => {
    const long = "x".repeat(PERSONA_PROMPT_MAX + 120);
    const identity = toUserIdentity({ display_name: "Sam", persona: long });
    expect(identity.displayName).toBe("Sam");
    expect(identity.persona).toHaveLength(PERSONA_PROMPT_MAX);
    expect(identity.persona).toBe(long.slice(0, PERSONA_PROMPT_MAX));
  });

  it("allowlists only display_name and persona (ignores other fields)", () => {
    const identity = toUserIdentity({
      display_name: "Jordan",
      persona: "Designer",
      // @ts-expect-error — ensure extra columns cannot leak into identity
      email: "jordan@example.com",
      default_model: "openai/gpt-4o",
    });
    expect(identity).toEqual({ displayName: "Jordan", persona: "Designer" });
    expect(JSON.stringify(identity)).not.toContain("jordan@example.com");
    expect(JSON.stringify(identity)).not.toContain("gpt-4o");
  });
});

describe("buildSystemPrompt identity block", () => {
  it("includes the user's name in USER IDENTITY", () => {
    const { systemPrompt, identity } = buildSystemPrompt([], [], {
      displayName: "Alex Rivera",
    });
    expect(identity.displayName).toBe("Alex Rivera");
    expect(systemPrompt).toContain("----- USER IDENTITY -----");
    expect(systemPrompt).toContain("The user's name is Alex Rivera.");
    expect(systemPrompt).toContain("USER IDENTITY is authoritative");
  });

  it("includes persona in USER IDENTITY", () => {
    const { systemPrompt } = buildSystemPrompt([], [], {
      persona: "Prefer short, direct answers",
    });
    expect(systemPrompt).toContain("Persona: Prefer short, direct answers");
  });

  it("omits the identity section when profile fields are empty", () => {
    const { systemPrompt } = buildSystemPrompt([], [], {});
    expect(systemPrompt).not.toContain("----- USER IDENTITY -----");
    expect(systemPrompt).toContain("No saved user context was relevant");
  });

  it("truncation is reflected in the prompt when persona is capped upstream", () => {
    const identity = toUserIdentity({
      display_name: "Sam",
      persona: "y".repeat(PERSONA_PROMPT_MAX + 50),
    });
    const { systemPrompt } = buildSystemPrompt([], [], identity);
    expect(systemPrompt).toContain(`Persona: ${"y".repeat(PERSONA_PROMPT_MAX)}`);
    expect(systemPrompt).not.toContain("y".repeat(PERSONA_PROMPT_MAX + 1));
  });

  it("states that profile identity wins over conflicting profile memories", () => {
    const conflicting = memory({
      content: "My name is Definitely Not Alex",
      type: "profile",
    });
    const { systemPrompt } = buildSystemPrompt([conflicting], [], {
      displayName: "Alex Rivera",
    });
    expect(systemPrompt).toContain("The user's name is Alex Rivera.");
    expect(systemPrompt).toContain("(profile) My name is Definitely Not Alex");
    expect(systemPrompt.indexOf("USER IDENTITY")).toBeLessThan(
      systemPrompt.indexOf("USER CONTEXT")
    );
    expect(systemPrompt).toContain("Never say you don't have their name");
  });
});
