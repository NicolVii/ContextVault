import { describe, expect, it } from "vitest";
import {
  AUTO_MODEL_ID,
  isValidModel,
  modelLabel,
  resolvedModelDisplay,
} from "../src/lib/ai/models";

describe("models helpers", () => {
  it("accepts auto and known models", () => {
    expect(isValidModel(AUTO_MODEL_ID)).toBe(true);
    expect(isValidModel("openai/gpt-4o-mini")).toBe(true);
    expect(isValidModel("unknown/model")).toBe(false);
  });

  it("formats auto display with resolved label", () => {
    expect(modelLabel(AUTO_MODEL_ID)).toBe("Auto");
    expect(resolvedModelDisplay(AUTO_MODEL_ID, "openai/gpt-4o-mini")).toBe(
      "Auto (GPT-4o mini)"
    );
    expect(resolvedModelDisplay("openai/gpt-4o", "openai/gpt-4o")).toBe("GPT-4o");
  });
});
