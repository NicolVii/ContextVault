import { describe, expect, it } from "vitest";
import { classifyIntent, stripRememberPrefix } from "../src/lib/think/intent";

describe("classifyIntent", () => {
  it("treats questions as questions", () => {
    expect(classifyIntent("What do I like?")).toBe("question");
    expect(classifyIntent("How tall am I")).toBe("question");
    expect(classifyIntent("where do I live?")).toBe("question");
  });

  it("treats imperatives as instructions", () => {
    expect(classifyIntent("Remember that I prefer tea")).toBe("instruction");
    expect(classifyIntent("Forget my old address")).toBe("instruction");
    expect(classifyIntent("Show my memories")).toBe("instruction");
  });

  it("treats declaratives as statements", () => {
    expect(classifyIntent("I am learning piano.")).toBe("statement");
    expect(classifyIntent("Meeting with Alex tomorrow at 3")).toBe("statement");
  });
});

describe("stripRememberPrefix", () => {
  it("removes remember prefixes", () => {
    expect(stripRememberPrefix("Remember that I prefer tea")).toBe("I prefer tea");
    expect(stripRememberPrefix("please remember to buy milk")).toBe("buy milk");
  });
});
