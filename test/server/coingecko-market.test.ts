import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StaticsMarketOverview } from "@/lib/market/types";

const mocks = vi.hoisted(() => ({
  loadSpot: vi.fn(),
  loadSupply: vi.fn(),
  simulateContract: vi.fn(),
}));

vi.mock("viem", async (importOriginal) => {
  const original = await importOriginal<typeof import("viem")>();
  return {
    ...original,
    createPublicClient: () => ({ simulateContract: mocks.simulateContract }),
    http: vi.fn(),
  };
});

vi.mock("@/lib/server/market-overview", () => ({
  loadMarketSpotOverview: mocks.loadSpot,
  loadMarketSupplySnapshot: mocks.loadSupply,
}));

vi.mock("@/lib/server/robinhood-rpc", () => ({ robinhoodRpcUrl: () => "https://rpc.example" }));
vi.mock("@/lib/server/statics-indexer-url", () => ({
  staticsMainnetIndexerUrl: (path: string) => new URL(`https://indexer.example/${path}`),
}));

import {
  coinGeckoSpotMarket,
  loadCoinGeckoHistoricalTrades,
  loadCoinGeckoStatus,
  loadCoinGeckoTickers,
  resetCoinGeckoMarketCacheForTest,
} from "@/lib/server/coingecko-market";

const WAD = 10n ** 18n;
const overview = {
  schemaVersion: 1,
  status: "fresh",
  chainId: 4_663,
  deploymentId: "robinhood-genesis",
  poolId: coinGeckoSpotMarket().poolId,
  asOfBlock: "123",
  price: {
    staticsPerWethWad: (250_000n * WAD).toString(),
    wethPerStaticsWad: 4_000_000_000_000n.toString(),
    ethUsdWad: (2_500n * WAD).toString(),
    staticsUsdWad: (WAD / 100n).toString(),
  },
  supply: {
    total: (1_000_000_000n * WAD).toString(),
    poolInventory: (100_000_000n * WAD).toString(),
    publicDistributed: (700_000_000n * WAD).toString(),
    unreleasedTreasury: (100_100_000n * WAD).toString(),
    vaultBacking: (117_900_000n * WAD).toString(),
    strictLiquidFloat: (682_000_000n * WAD).toString(),
  },
  valuation: {
    fdvUsdWad: (10_000_000n * WAD).toString(),
    publicMarketCapUsdWad: (7_000_000n * WAD).toString(),
    liquidFloatMarketCapUsdWad: (6_820_000n * WAD).toString(),
  },
  liquidity: {
    principalWeth: (400n * WAD).toString(),
    principalStatics: (100_000_000n * WAD).toString(),
    tvlUsdWad: (2_000_000n * WAD).toString(),
  },
  activity24h: {
    available: true,
    wethVolume: (40n * WAD).toString(),
    staticsVolume: (10_000_000n * WAD).toString(),
    swaps: 12,
    buys: 7,
    sells: 5,
    priceChangeBps: 125,
    highWethPerStaticsWad: 5_000_000_000_000n.toString(),
    lowWethPerStaticsWad: 3_000_000_000_000n.toString(),
    lastWethPerStaticsWad: 4_000_000_000_000n.toString(),
    lastTradeAt: "2026-09-01T11:59:50.000Z",
  },
  depth: null,
  freshness: {
    indexedAt: "2026-09-01T11:59:50.000Z",
    snapshotAt: "2026-09-01T12:00:00.000Z",
    depthAt: null,
    usdPriceAt: "2026-09-01T12:00:00.000Z",
    usdPriceStale: false,
  },
} satisfies StaticsMarketOverview;

beforeEach(() => {
  resetCoinGeckoMarketCacheForTest();
  mocks.loadSpot.mockReset().mockResolvedValue(overview);
  mocks.loadSupply.mockReset();
  mocks.simulateContract.mockReset().mockImplementation(({ args }) =>
    Promise.resolve({
      result: [args[0].zeroForOne ? 2_500n * WAD : (98n * WAD) / 10_000n],
    })
  );
  vi.restoreAllMocks();
});

describe("CoinGecko market server adapter", () => {
  it("coalesces ticker reads and performs only two executable quote calls per cache fill", async () => {
    const first = await loadCoinGeckoTickers(1_000);
    const second = await loadCoinGeckoTickers(2_000);
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({ bid: "0.00000392", ask: "0.000004" });
    expect(mocks.loadSpot).toHaveBeenCalledTimes(1);
    expect(mocks.simulateContract).toHaveBeenCalledTimes(2);
  });

  it("uses a bounded last-good ticker when a refresh dependency fails", async () => {
    const first = await loadCoinGeckoTickers(1_000);
    mocks.loadSpot.mockRejectedValue(new Error("Indexer unavailable"));
    await expect(loadCoinGeckoTickers(62_000)).resolves.toEqual(first);
    await expect(loadCoinGeckoTickers(302_000)).rejects.toThrow("Indexer unavailable");
  });

  it("loads filtered canonical trades without exposing the authenticated market API", async () => {
    const market = coinGeckoSpotMarket();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              poolId: market.poolId,
              amount0: (8n * 10n ** 12n).toString(),
              amount1: (-2n * WAD).toString(),
              volume0: (8n * 10n ** 12n).toString(),
              volume1: (2n * WAD).toString(),
              price1Per0Wad: (250_000n * WAD).toString(),
              transactionHash: `0x${"34".repeat(32)}`,
              blockNumber: "123",
              blockTimestamp: "1788278400",
              logIndex: 7,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const result = await loadCoinGeckoHistoricalTrades({
      limit: 500,
      from: "10",
      to: "20",
      side: "buy",
    });
    expect(result.buy[0]).toMatchObject({ type: "buy", price: "0.000004" });
    const requested = new URL(String(vi.mocked(fetch).mock.calls[0]?.[0]));
    expect(requested.pathname).toBe("/market/trades");
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      limit: "500",
      pool: market.poolId,
      from: "10",
      to: "20",
      amount0Sign: "positive",
    });
  });

  it("reports indexer block lag independently from the age of the last trade", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ active: { id: 4_663, block: { number: 456, timestamp: 1_788_278_390 } } }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    await expect(loadCoinGeckoStatus(1_788_278_400_000)).resolves.toMatchObject({
      indexed_block: "456",
      indexed_at: "2026-09-01T15:59:50.000Z",
      last_trade_at: overview.activity24h.lastTradeAt,
      lag_seconds: 10,
    });
  });
});
