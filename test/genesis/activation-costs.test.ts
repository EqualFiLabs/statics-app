import { describe, expect, it } from "vitest";

import { cumulativeGenesisActivationCost } from "@statics-protocol/sdk";

import { oneIndexedGenesisTierCosts } from "@/lib/genesis/activation-costs";

describe("Genesis activation tier costs", () => {
  it("aligns RPC tier reads with the SDK's one-indexed cost lookup", () => {
    const tierCosts = oneIndexedGenesisTierCosts([10n, 20n, 30n, 40n]);

    expect(cumulativeGenesisActivationCost(tierCosts, 0, 1)).toBe(10n);
    expect(cumulativeGenesisActivationCost(tierCosts, 3, 4)).toBe(40n);
    expect(cumulativeGenesisActivationCost(tierCosts, 0, 4)).toBe(100n);
  });

  it("rejects incomplete tier-cost reads", () => {
    expect(() => oneIndexedGenesisTierCosts([10n, 20n, 30n])).toThrow("exactly four tier costs");
  });
});
