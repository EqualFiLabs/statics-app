import { describe, expect, it } from "vitest";

import { maximumBorrowShares, maximumRepayAssets } from "@/lib/morpho/morpho";

const market = {
  totalSupplyAssets: 1_000_000n,
  totalSupplyShares: 1_000_000n,
  totalBorrowAssets: 500_000n,
  totalBorrowShares: 500_000n,
  lastUpdate: 1n,
  fee: 0n,
};

describe("Morpho transaction bounds", () => {
  it("rounds borrow shares up and adds a one-percent ceiling", () => {
    expect(maximumBorrowShares(100n, market)).toBe(303n);
  });

  it("rounds repay assets up and adds a one-percent ceiling", () => {
    expect(maximumRepayAssets(300n, market)).toBe(104n);
  });

  it("keeps zero amounts at zero", () => {
    expect(maximumBorrowShares(0n, market)).toBe(0n);
    expect(maximumRepayAssets(0n, market)).toBe(0n);
  });
});
