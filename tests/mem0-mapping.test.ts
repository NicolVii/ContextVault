import { describe, it, expect } from "vitest";
import {
  buildMem0Metadata,
  parseMem0Id,
  toExpirationDate,
  withMem0Id,
} from "../src/lib/memory/mem0/mapping";

describe("mem0 mapping helpers", () => {
  it("builds metadata with Context Vault fields", () => {
    const metadata = buildMem0Metadata("cv-1", {
      content: "I like tea",
      type: "preference",
      source: "manual",
      status: "active",
      category: "food",
      confidence: 0.9,
      is_sensitive: false,
    });
    expect(metadata).toEqual({
      cv_memory_id: "cv-1",
      type: "preference",
      source: "manual",
      status: "active",
      category: "food",
      source_detail: null,
      confidence: 0.9,
      is_sensitive: false,
    });
  });

  it("stores and parses mem0 ids in source_detail", () => {
    const mem0Id = "11111111-2222-4333-8444-555555555555";
    expect(withMem0Id(null, mem0Id)).toBe(`mem0:${mem0Id}`);
    expect(withMem0Id("chat:abc", mem0Id)).toBe(`chat:abc;mem0:${mem0Id}`);
    expect(parseMem0Id(`chat:abc;mem0:${mem0Id}`)).toBe(mem0Id);
  });

  it("normalizes expiration dates to YYYY-MM-DD", () => {
    expect(toExpirationDate("2026-12-31T23:59:59.000Z")).toBe("2026-12-31");
    expect(toExpirationDate(null)).toBeNull();
  });
});
