import { describe, it, expect } from "vitest";
import { scanForForbiddenSecrets, isSensitive } from "../src/lib/memory/redaction";
import { extractCandidates } from "../src/lib/memory/extraction";

describe("forbidden secret detection", () => {
  it("blocks passwords, API keys, cards, SSNs", () => {
    expect(scanForForbiddenSecrets("my password is hunter2").blocked).toBe(true);
    expect(scanForForbiddenSecrets("api_key: sk-abc123def456ghi789xyz").blocked).toBe(true);
    expect(scanForForbiddenSecrets("card number 4111 1111 1111 1111").blocked).toBe(true);
    expect(scanForForbiddenSecrets("my ssn is 123-45-6789").blocked).toBe(true);
  });

  it("does not block ordinary statements", () => {
    expect(scanForForbiddenSecrets("I prefer tea over coffee").blocked).toBe(false);
    expect(scanForForbiddenSecrets("I live in Lisbon").blocked).toBe(false);
  });
});

describe("sensitivity detection", () => {
  it("flags medical and financial content as sensitive", () => {
    expect(isSensitive("I was diagnosed with diabetes")).toBe(true);
    expect(isSensitive("my salary is quite high")).toBe(true);
  });
  it("does not flag ordinary preferences", () => {
    expect(isSensitive("I like dark mode")).toBe(false);
  });
});

describe("memory extraction", () => {
  it("never auto-extracts forbidden secrets", () => {
    const candidates = extractCandidates(
      "My name is Dana. My password is hunter2 and my api key is sk-abcdef1234567890."
    );
    const contents = candidates.map((c) => c.content.toLowerCase());
    expect(contents.some((c) => c.includes("password") || c.includes("api key"))).toBe(false);
    // The benign profile fact is still captured.
    expect(candidates.some((c) => c.type === "profile")).toBe(true);
  });

  it("extracts preferences and flags sensitive candidates", () => {
    const candidates = extractCandidates("I prefer concise answers. I was diagnosed with asthma.");
    expect(candidates.some((c) => c.type === "preference")).toBe(true);
    const medical = candidates.find((c) => /asthma|diagnosed/.test(c.content));
    if (medical) expect(medical.is_sensitive).toBe(true);
  });
});
