import { formatUnits, type Address, type Hex } from "viem";

import { canonicalWethPerStaticsFromPrice1Per0 } from "@/lib/market/analytics";
import type { MarketSupplySnapshot, StaticsMarketOverview } from "@/lib/market/types";

export type CoinGeckoSpotMarket = Readonly<{
  tickerId: string;
  baseCurrency: Address;
  targetCurrency: Address;
  poolId: Hex;
  staticsIsCurrency0: boolean;
}>;

export type IndexedMarketTrade = Readonly<{
  poolId: string;
  amount0: string;
  amount1: string;
  volume0: string;
  volume1: string;
  price1Per0Wad: string;
  transactionHash: string;
  blockNumber: string;
  blockTimestamp: string;
  logIndex: number;
}>;

export type CoinGeckoTradeSide = "buy" | "sell";

export function coinGeckoTickerId(base: Address, target: Address): string {
  return `${base.toLowerCase()}_${target.toLowerCase()}`;
}

function decimalWad(raw: bigint): string {
  return formatUnits(raw, 18);
}

function coinGeckoTradeId(blockNumber: bigint, logIndex: number): number {
  if (!Number.isSafeInteger(logIndex) || logIndex < 0 || logIndex >= 1_000_000) {
    throw new Error("Trade log index is outside the supported range.");
  }
  const value = blockNumber * 1_000_000n + BigInt(logIndex);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Trade identifier exceeds the JSON safe-integer range.");
  }
  return Number(value);
}

export function coinGeckoTrade(trade: IndexedMarketTrade, market: CoinGeckoSpotMarket) {
  const staticsAmount = BigInt(market.staticsIsCurrency0 ? trade.amount0 : trade.amount1);
  const staticsVolume = BigInt(market.staticsIsCurrency0 ? trade.volume0 : trade.volume1);
  const wethVolume = BigInt(market.staticsIsCurrency0 ? trade.volume1 : trade.volume0);
  const price = canonicalWethPerStaticsFromPrice1Per0(
    BigInt(trade.price1Per0Wad),
    market.staticsIsCurrency0
  );
  const type: CoinGeckoTradeSide = staticsAmount < 0n ? "buy" : "sell";
  return {
    trade_id: coinGeckoTradeId(BigInt(trade.blockNumber), trade.logIndex),
    price: decimalWad(price),
    base_volume: decimalWad(staticsVolume),
    target_volume: decimalWad(wethVolume),
    trade_timestamp: trade.blockTimestamp,
    type,
  } as const;
}

export function coinGeckoHistoricalTrades(
  trades: readonly IndexedMarketTrade[],
  market: CoinGeckoSpotMarket,
  side?: CoinGeckoTradeSide
) {
  const result = {
    buy: [] as ReturnType<typeof coinGeckoTrade>[],
    sell: [] as ReturnType<typeof coinGeckoTrade>[],
  };
  for (const trade of trades) {
    const converted = coinGeckoTrade(trade, market);
    if (side && converted.type !== side) continue;
    result[converted.type].push(converted);
  }
  return result;
}

export function coinGeckoTicker(
  overview: StaticsMarketOverview,
  market: CoinGeckoSpotMarket,
  quote: Readonly<{ bidWethPerStaticsWad: bigint | null; askWethPerStaticsWad: bigint | null }>,
  lastTradeWethPerStaticsWad: bigint | null = null
) {
  if (!overview.activity24h.available || overview.liquidity.tvlUsdWad === null) {
    throw new Error("Public ticker dependencies are unavailable.");
  }
  const lastPrice = overview.activity24h.lastWethPerStaticsWad
    ? BigInt(overview.activity24h.lastWethPerStaticsWad)
    : lastTradeWethPerStaticsWad;
  if (lastPrice === null || lastPrice <= 0n) {
    throw new Error("The last transacted market price is unavailable.");
  }
  const high = overview.activity24h.highWethPerStaticsWad;
  const low = overview.activity24h.lowWethPerStaticsWad;
  return {
    ticker_id: market.tickerId,
    base_currency: market.baseCurrency.toLowerCase(),
    target_currency: market.targetCurrency.toLowerCase(),
    pool_id: market.poolId.toLowerCase(),
    last_price: decimalWad(lastPrice),
    base_volume: formatUnits(BigInt(overview.activity24h.staticsVolume), 18),
    target_volume: formatUnits(BigInt(overview.activity24h.wethVolume), 18),
    liquidity_in_usd: formatUnits(BigInt(overview.liquidity.tvlUsdWad), 18),
    ...(quote.bidWethPerStaticsWad === null ? {} : { bid: decimalWad(quote.bidWethPerStaticsWad) }),
    ...(quote.askWethPerStaticsWad === null ? {} : { ask: decimalWad(quote.askWethPerStaticsWad) }),
    ...(high === null ? {} : { high: decimalWad(BigInt(high)) }),
    ...(low === null ? {} : { low: decimalWad(BigInt(low)) }),
  } as const;
}

export function coinGeckoCirculatingSupply(snapshot: MarketSupplySnapshot): bigint {
  const total = BigInt(snapshot.total);
  const excluded = BigInt(snapshot.unreleasedTreasury) + BigInt(snapshot.vaultBacking);
  if (excluded > total) throw new Error("Circulating-supply exclusions exceed total supply.");
  return total - excluded;
}

export function coinGeckoSupplyResult(raw: string, decimals: number): Readonly<{ result: string }> {
  return { result: formatUnits(BigInt(raw), decimals) };
}

export function coinGeckoSupplyDisclosure(snapshot: MarketSupplySnapshot) {
  const circulatingSupply = coinGeckoCirculatingSupply(snapshot);
  return {
    schema_version: 1,
    asset: "STATICS",
    chain_id: snapshot.chainId,
    contract_address: snapshot.tokenAddress,
    decimals: snapshot.decimals,
    total_supply: formatUnits(BigInt(snapshot.total), snapshot.decimals),
    circulating_supply: formatUnits(circulatingSupply, snapshot.decimals),
    public_distributed_supply: formatUnits(BigInt(snapshot.publicDistributed), snapshot.decimals),
    exclusions: {
      unreleased_treasury_vesting: formatUnits(
        BigInt(snapshot.unreleasedTreasury),
        snapshot.decimals
      ),
      operator_vault_backing: formatUnits(BigInt(snapshot.vaultBacking), snapshot.decimals),
    },
    methodology:
      "total_supply - unreleased_treasury_vesting - operator_vault_backing; canonical AMM pool inventory remains circulating because it is publicly tradable",
    status: snapshot.status,
    as_of_block: snapshot.asOfBlock,
    updated_at: snapshot.snapshotAt,
  } as const;
}
