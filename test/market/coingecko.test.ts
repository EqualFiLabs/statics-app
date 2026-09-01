import { describe, expect, it } from "vitest";

import {
  coinGeckoSupplyDisclosure,
  coinGeckoSupplyResult,
  coinGeckoTicker,
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

const overview = {
  schemaVersion: 1,
  status: "fresh",
  chainId: 4_663,
  deploymentId: "robinhood-genesis",
  poolId: `0x${"1".repeat(64)}`,
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
  },
  depth: {
    buyStatics: [
      {
        targetImpactBps: 200,
        actualImpactBps: 199,
        inputToken: "WETH",
        outputToken: "STATICS",
        amountIn: WAD.toString(),
        amountOut: (250_000n * WAD).toString(),
        inputUsdWad: (2_500n * WAD).toString(),
      },
    ],
    sellStatics: [
      {
        targetImpactBps: 200,
        actualImpactBps: 199,
        inputToken: "STATICS",
        outputToken: "WETH",
        amountIn: (250_000n * WAD).toString(),
        amountOut: WAD.toString(),
        inputUsdWad: (2_500n * WAD).toString(),
      },
    ],
  },
  freshness: {
    indexedAt: "2026-09-01T11:59:00.000Z",
    snapshotAt: supply.snapshotAt,
    depthAt: supply.snapshotAt,
    usdPriceAt: supply.snapshotAt,
    usdPriceStale: false,
  },
} satisfies StaticsMarketOverview;

describe("CoinGecko market payloads", () => {
  it("returns decimal token units and discloses every circulating-supply exclusion", () => {
    expect(coinGeckoSupplyResult(supply.total, supply.decimals)).toEqual({
      result: "1000000000",
    });
    expect(coinGeckoSupplyResult(supply.strictLiquidFloat, supply.decimals)).toEqual({
      result: "682100000",
    });
    expect(coinGeckoSupplyDisclosure(supply)).toMatchObject({
      total_supply: "1000000000",
      circulating_supply: "682100000",
      exclusions: {
        canonical_pool_inventory: "99900000",
        unreleased_treasury_vesting: "100100000",
        operator_vault_backing: "117900000",
      },
      as_of_block: "123",
    });
  });

  it("maps canonical activity and two-percent executable depth into the ticker", () => {
    expect(coinGeckoTicker(overview)).toMatchObject({
      ticker_id: "STATICS_WETH",
      last_price: 0.000004,
      base_volume: 10_000_000,
      target_volume: 40,
      volume_usd: 100_000,
      liquidity_usd: 2_000_000,
      price_change_percent_24h: 1.25,
      cost_to_move_up_usd: 2_500,
      cost_to_move_down_usd: 2_500,
      converted_last: { usd: 0.01 },
    });
  });

  it("fails closed instead of reporting an indexer outage as zero volume", () => {
    expect(() =>
      coinGeckoTicker({
        ...overview,
        activity24h: { ...overview.activity24h, available: false },
      })
    ).toThrow("Public ticker dependencies are unavailable.");
  });
});
