import { describe, expect, it } from "vitest";
import {
  grantAutoBonus,
  grantCreditBonus,
  grantFrontierBonus,
  resetUserPlanUsage,
} from "../src/lib/admin/mutations";

const fakeIds = {
  userId: "00000000-0000-4000-8000-000000000001",
  actorUserId: "00000000-0000-4000-8000-000000000002",
};

describe("admin mutations reason gate", () => {
  it("rejects usage reset without a real reason", async () => {
    await expect(
      resetUserPlanUsage({
        ...fakeIds,
        reason: "  ",
      })
    ).rejects.toThrow(/reason/i);
  });

  it("rejects Auto bonus without a reason", async () => {
    await expect(
      grantAutoBonus({
        ...fakeIds,
        amount: 5,
        reason: "ab",
      })
    ).rejects.toThrow(/reason/i);
  });

  it("rejects Frontier bonus with non-positive amount", async () => {
    await expect(
      grantFrontierBonus({
        ...fakeIds,
        amount: 0,
        reason: "support courtesy",
      })
    ).rejects.toThrow(/positive/i);
  });

  it("rejects credit bonus with empty reason before touching the wallet", async () => {
    await expect(
      grantCreditBonus({
        ...fakeIds,
        amount: 100,
        reason: "",
      })
    ).rejects.toThrow(/reason/i);
  });
});
