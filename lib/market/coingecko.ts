import { formatUnits } from "viem";

import type { MarketSupplySnapshot, StaticsMarketOverview } from "@/lib/market/types";

function decimalNumber(raw: string, decimals = 18): number {
  const value = Number(formatUnits(BigInt(raw), decimals));
  if (!Number.isFinite(value)) throw new Error("Market value cannot be represented as JSON.");
  return value;
}

function depthCost(
  levels: NonNullable<StaticsMarketOverview["depth"]>["buyStatics"]
): number | null {
  const level = levels.find((candidate) => candidate.targetImpactBps === 200);
  return level?.inputUsdWad === null || level?.inputUsdWad === undefined
    ? null
    : decimalNumber(level.inputUsdWad);
}

export function coinGeckoSupplyResult(raw: string, decimals: number): Readonly<{ result: string }> {
  return { result: formatUnits(BigInt(raw), decimals) };
}

export function coinGeckoSupplyDisclosure(snapshot: MarketSupplySnapshot) {
  return {
    schema_version: 1,
    asset: "STATICS",
    chain_id: snapshot.chainId,
    contract_address: snapshot.tokenAddress,
    decimals: snapshot.decimals,
    total_supply: formatUnits(BigInt(snapshot.total), snapshot.decimals),
    circulating_supply: formatUnits(BigInt(snapshot.strictLiquidFloat), snapshot.decimals),
    public_distributed_supply: formatUnits(BigInt(snapshot.publicDistributed), snapshot.decimals),
    exclusions: {
      canonical_pool_inventory: formatUnits(BigInt(snapshot.poolInventory), snapshot.decimals),
      unreleased_treasury_vesting: formatUnits(
        BigInt(snapshot.unreleasedTreasury),
        snapshot.decimals
      ),
      operator_vault_backing: formatUnits(BigInt(snapshot.vaultBacking), snapshot.decimals),
    },
    methodology:
      "total_supply - canonical_pool_inventory - unreleased_treasury_vesting - operator_vault_backing",
    status: snapshot.status,
    as_of_block: snapshot.asOfBlock,
    updated_at: snapshot.snapshotAt,
  } as const;
}

export function coinGeckoTicker(overview: StaticsMarketOverview) {
  if (
    !overview.activity24h.available ||
    overview.price.ethUsdWad === null ||
    overview.price.staticsUsdWad === null ||
    overview.liquidity.tvlUsdWad === null
  ) {
    throw new Error("Public ticker dependencies are unavailable.");
  }
  const depth = overview.depth;
  const wethVolumeUsdWad =
    (BigInt(overview.activity24h.wethVolume) * BigInt(overview.price.ethUsdWad)) / 10n ** 18n;
  return {
    ticker_id: "STATICS_WETH",
    base_currency: "STATICS",
    target_currency: "WETH",
    last_price: decimalNumber(overview.price.wethPerStaticsWad),
    base_volume: decimalNumber(overview.activity24h.staticsVolume),
    target_volume: decimalNumber(overview.activity24h.wethVolume),
    volume_usd: decimalNumber(wethVolumeUsdWad.toString()),
    liquidity_usd: decimalNumber(overview.liquidity.tvlUsdWad),
    price_change_percent_24h: overview.activity24h.priceChangeBps / 100,
    cost_to_move_up_usd: depth ? depthCost(depth.buyStatics) : null,
    cost_to_move_down_usd: depth ? depthCost(depth.sellStatics) : null,
    converted_last: { usd: decimalNumber(overview.price.staticsUsdWad) },
    converted_volume: { usd: decimalNumber(wethVolumeUsdWad.toString()) },
    last_trade_at: overview.freshness.indexedAt,
    data_updated_at: overview.freshness.snapshotAt,
    as_of_block: overview.asOfBlock,
  } as const;
}
