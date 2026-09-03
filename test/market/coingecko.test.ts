import { getAddress } from "viem";
import { describe, expect, it } from "vitest";

import {
  coinGeckoCirculatingSupply,
  coinGeckoHistoricalTrades,
  coinGeckoSupplyDisclosure,
  coinGeckoSupplyResult,
  coinGeckoTicker,
  coinGeckoTickerId,
  type CoinGeckoSpotMarket,
  type IndexedMarketTrade,
} from "@/lib/market/coingecko";
import type { MarketSupplySnapshot, StaticsMarketOverview } from "@/lib/market/types";

const WAD = 10n ** 18n;
const supply = {
  status: "fresh",
  chainId: 4_663,
  deploymentId: "robinhood-genesis",
  tokenAddress: "0x2d8d6F4A93AcD7a916A5a654ec8b690bA3B3EAdd",
  decimals: 18,
  asOfBlock: "123",
  snapshotAt: "2026-09-01T12:00:00.000Z",
  total: (1_000_000_000n * WAD).toString(),
  poolInventory: (99_900_000n * WAD).toString(),
  publicDistributed: (700_100_000n * WAD).toString(),
  unreleasedTreasury: (100_100_000n * WAD).toString(),
  vaultBacking: (117_900_000n * WAD).toString(),
  strictLiquidFloat: (682_100_000n * WAD).toString(),
} satisfies MarketSupplySnapshot;

const baseCurrency = getAddress("0x2222222222222222222222222222222222222222");
const targetCurrency = getAddress("0x1111111111111111111111111111111111111111");
const market = {
  tickerId: coinGeckoTickerId(baseCurrency, targetCurrency),
  baseCurrency,
  targetCurrency,
  poolId: `0x${"12".repeat(32)}`,
  staticsIsCurrency0: true,
} satisfies CoinGeckoSpotMarket;

const overview = {
  schemaVersion: 1,
  status: "fresh",
  chainId: 4_663,
  deploymentId: "robinhood-genesis",
  poolId: market.poolId,
  asOfBlock: "123",
  price: {
    staticsPerWethWad: (250_000n * WAD).toString(),
    wethPerStaticsWad: (WAD / 250_000n).toString(),
    ethUsdWad: (2_500n * WAD).toString(),
    staticsUsdWad: (WAD / 100n).toString(),
  },
  supply: {
    total: supply.total,
    poolInventory: supply.poolInventory,
    publicDistributed: supply.publicDistributed,
    unreleasedTreasury: supply.unreleasedTreasury,
    vaultBacking: supply.vaultBacking,
    strictLiquidFloat: supply.strictLiquidFloat,
  },
  valuation: {
    fdvUsdWad: (10_000_000n * WAD).toString(),
    publicMarketCapUsdWad: (7_001_000n * WAD).toString(),
    liquidFloatMarketCapUsdWad: (6_821_000n * WAD).toString(),
  },
  liquidity: {
    principalWeth: (400n * WAD).toString(),
    principalStatics: supply.poolInventory,
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
    lastTradeAt: "2026-09-01T11:59:00.000Z",
  },
  depth: null,
  freshness: {
    indexedAt: "2026-09-01T11:59:00.000Z",
    snapshotAt: supply.snapshotAt,
    depthAt: null,
    usdPriceAt: supply.snapshotAt,
    usdPriceStale: false,
  },
} satisfies StaticsMarketOverview;

function indexedTrade(overrides: Partial<IndexedMarketTrade> = {}): IndexedMarketTrade {
  return {
    poolId: market.poolId,
    amount0: (-2n * WAD).toString(),
    amount1: (8n * 10n ** 12n).toString(),
    volume0: (2n * WAD).toString(),
    volume1: (8n * 10n ** 12n).toString(),
    price1Per0Wad: 4_000_000_000_000n.toString(),
    transactionHash: `0x${"34".repeat(32)}`,
    blockNumber: "123",
    blockTimestamp: "1788278400",
    logIndex: 7,
    ...overrides,
  };
}

describe("CoinGecko market payloads", () => {
  it("keeps publicly tradable AMM inventory in circulating supply", () => {
    expect(coinGeckoCirculatingSupply(supply)).toBe(782_000_000n * WAD);
    expect(coinGeckoSupplyResult(supply.total, supply.decimals)).toEqual({
      result: "1000000000",
    });
    expect(
      coinGeckoSupplyResult(coinGeckoCirculatingSupply(supply).toString(), supply.decimals)
    ).toEqual({
      result: "782000000",
    });
    expect(coinGeckoSupplyDisclosure(supply)).toMatchObject({
      total_supply: "1000000000",
      circulating_supply: "782000000",
      exclusions: {
        unreleased_treasury_vesting: "100100000",
        operator_vault_backing: "117900000",
      },
      as_of_block: "123",
    });
  });

  it("rejects impossible exclusion totals", () => {
    expect(() =>
      coinGeckoCirculatingSupply({ ...supply, vaultBacking: (1_000_000_000n * WAD).toString() })
    ).toThrow("Circulating-supply exclusions exceed total supply.");
  });

  it("returns CoinGecko DEX ticker decimals and executable quotes", () => {
    expect(
      coinGeckoTicker(overview, market, {
        bidWethPerStaticsWad: 3_900_000_000_000n,
        askWethPerStaticsWad: 4_100_000_000_000n,
      })
    ).toEqual({
      ticker_id: market.tickerId,
      base_currency: baseCurrency.toLowerCase(),
      target_currency: targetCurrency.toLowerCase(),
      pool_id: market.poolId,
      last_price: "0.000004",
      base_volume: "10000000",
      target_volume: "40",
      liquidity_in_usd: "2000000",
      bid: "0.0000039",
      ask: "0.0000041",
      high: "0.000005",
      low: "0.000003",
    });
  });

  it("maps indexed direction, amounts, and stable integer trade IDs", () => {
    expect(coinGeckoHistoricalTrades([indexedTrade()], market)).toEqual({
      buy: [
        {
          trade_id: 123000007,
          price: "0.000004",
          base_volume: "2",
          target_volume: "0.000008",
          trade_timestamp: "1788278400",
          type: "buy",
        },
      ],
      sell: [],
    });
    expect(
      coinGeckoHistoricalTrades(
        [indexedTrade({ amount0: (2n * WAD).toString(), logIndex: 8 })],
        market,
        "buy"
      )
    ).toEqual({ buy: [], sell: [] });
  });

  it("inverts execution prices when STATICS is currency1", () => {
    const invertedMarket = { ...market, staticsIsCurrency0: false };
    const result = coinGeckoHistoricalTrades(
      [
        indexedTrade({
          amount0: (-8n * 10n ** 12n).toString(),
          amount1: (2n * WAD).toString(),
          volume0: (8n * 10n ** 12n).toString(),
          volume1: (2n * WAD).toString(),
          price1Per0Wad: (250_000n * WAD).toString(),
        }),
      ],
      invertedMarket
    );
    expect(result.sell[0]).toMatchObject({
      price: "0.000004",
      base_volume: "2",
      target_volume: "0.000008",
      type: "sell",
    });
  });
});
