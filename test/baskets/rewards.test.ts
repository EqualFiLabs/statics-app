import { describe, expect, it } from "vitest";

import { totalRewardsByAsset, type BasketRewardEntry } from "@/lib/baskets/rewards";

const token = (address: string, symbol: string) => ({
  address: address as `0x${string}`,
  name: symbol,
  symbol,
  decimals: 18,
  metadataAvailable: true,
});

const weth = token("0x0000000000000000000000000000000000000001", "WETH");
const wbtc = token("0x0000000000000000000000000000000000000002", "WBTC");

function entry(overrides: Partial<BasketRewardEntry> = {}): BasketRewardEntry {
  return {
    positionId: 1n,
    basketId: 1n,
    basketName: "Majors",
    basketSymbol: "MAJ",
    depositedShares: 100n,
    amounts: [
      { token: weth, amount: 5n },
      { token: wbtc, amount: 0n },
    ],
    claimable: true,
    ...overrides,
  };
}

describe("basket rewards", () => {
  it("sums one asset across every deposited basket", () => {
    const totals = totalRewardsByAsset([
      entry(),
      entry({
        basketId: 2n,
        amounts: [
          { token: weth, amount: 7n },
          { token: wbtc, amount: 3n },
        ],
      }),
    ]);

    expect(totals).toEqual([
      { token: weth, amount: 12n },
      { token: wbtc, amount: 3n },
    ]);
  });

  it("keeps assets apart across positions rather than merging by index", () => {
    // Reward asset lists are per basket, so two baskets can report different
    // assets in different orders. Summing positionally would cross the wires.
    const totals = totalRewardsByAsset([
      entry({ amounts: [{ token: weth, amount: 4n }] }),
      entry({ positionId: 2n, amounts: [{ token: wbtc, amount: 9n }] }),
    ]);

    expect(totals).toEqual([
      { token: weth, amount: 4n },
      { token: wbtc, amount: 9n },
    ]);
  });

  it("omits assets that have earned nothing", () => {
    const totals = totalRewardsByAsset([
      entry({ amounts: [{ token: weth, amount: 0n }], claimable: false }),
    ]);

    expect(totals).toEqual([]);
  });

  it("reports no totals when nothing is deposited", () => {
    expect(totalRewardsByAsset([])).toEqual([]);
  });
});
