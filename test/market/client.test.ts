import { describe, expect, it } from "vitest";

import { isStaticsMarketOverview } from "@/lib/market/client";

const fixture = {
  schemaVersion: 1,
  status: "fresh",
  chainId: 4_663,
  deploymentId: "robinhood-genesis",
  poolId: `0x${"1".repeat(64)}`,
  asOfBlock: "123",
  price: {
    staticsPerWethWad: "1000000000000000000",
    wethPerStaticsWad: "1000000000000000000",
    ethUsdWad: "2500000000000000000000",
    staticsUsdWad: "2500000000000000000000",
  },
  supply: {
    total: "1000000000000000000000000000",
    poolInventory: "100",
    publicDistributed: "200",
    unreleasedTreasury: "300",
    vaultBacking: "400",
    strictLiquidFloat: "500",
  },
  valuation: {
    fdvUsdWad: "1",
    publicMarketCapUsdWad: "2",
    liquidFloatMarketCapUsdWad: "3",
  },
  liquidity: { principalWeth: "4", principalStatics: "5", tvlUsdWad: "6" },
  activity24h: {
    available: true,
    wethVolume: "7",
    staticsVolume: "8",
    swaps: 9,
    buys: 5,
    sells: 4,
    priceChangeBps: -25,
  },
  depth: {
    buyStatics: [
      {
        targetImpactBps: 100,
        actualImpactBps: 99,
        inputToken: "WETH",
        outputToken: "STATICS",
        amountIn: "10",
        amountOut: "11",
        inputUsdWad: "12",
      },
    ],
    sellStatics: [],
  },
  freshness: {
    indexedAt: "2026-08-31T00:00:00.000Z",
    snapshotAt: "2026-08-31T00:00:00.000Z",
    depthAt: "2026-08-31T00:00:00.000Z",
    usdPriceAt: "2026-08-31T00:00:00.000Z",
    usdPriceStale: false,
  },
};

describe("market analytics response validation", () => {
  it("accepts the versioned canonical response", () => {
    expect(isStaticsMarketOverview(fixture)).toBe(true);
  });

  it("rejects the wrong chain and malformed numeric fields", () => {
    expect(isStaticsMarketOverview({ ...fixture, chainId: 1 })).toBe(false);
    expect(
      isStaticsMarketOverview({
        ...fixture,
        supply: { ...fixture.supply, publicDistributed: "800 million" },
      })
    ).toBe(false);
  });
});
