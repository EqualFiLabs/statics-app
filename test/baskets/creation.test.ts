import { describe, expect, it } from "vitest";

import {
  parseBasketCreationBps,
  parseBasketCreationTiers,
} from "@/components/baskets/BasketCreatePage";

describe("basket creation validation", () => {
  it("parses percentage inputs into bounded basis points", () => {
    expect(parseBasketCreationBps("0.05")).toBe(5);
    expect(parseBasketCreationBps("95")).toBe(9_500);
    expect(parseBasketCreationBps("100.01")).toBeNull();
  });

  it("requires strictly ascending fee-tier thresholds", () => {
    expect(parseBasketCreationTiers([])).toEqual([]);
    expect(
      parseBasketCreationTiers([
        { threshold: "0", feeShares: "0.1" },
        { threshold: "100", feeShares: "0.05" },
      ])
    ).toEqual([
      { minActionShares: 0n, feeShares: 100_000_000_000_000_000n },
      { minActionShares: 100_000_000_000_000_000_000n, feeShares: 50_000_000_000_000_000n },
    ]);
    expect(
      parseBasketCreationTiers([
        { threshold: "100", feeShares: "0.1" },
        { threshold: "100", feeShares: "0.05" },
      ])
    ).toBeNull();
  });
});
