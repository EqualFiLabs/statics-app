import { createPublicClient, http, isHex, size } from "viem";

import { v4QuoterAbi } from "@statics-protocol/sdk";

import { deploymentRegistry, ROBINHOOD_GENESIS_DEPLOYMENT_ID } from "@/lib/deployments/registry";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { canonicalWethPerStaticsFromPrice1Per0, WAD } from "@/lib/market/analytics";
import {
  coinGeckoHistoricalTrades,
  coinGeckoTicker,
  coinGeckoTickerId,
  type CoinGeckoSpotMarket,
  type CoinGeckoTradeSide,
  type IndexedMarketTrade,
} from "@/lib/market/coingecko";
import { poolKeyForLaunch, zeroForTrade } from "@/lib/trade/canonical-market";
import { loadMarketSpotOverview, loadMarketSupplySnapshot } from "@/lib/server/market-overview";
import { robinhoodRpcUrl } from "@/lib/server/robinhood-rpc";
import { staticsMainnetIndexerUrl } from "@/lib/server/statics-indexer-url";

const TICKER_TTL_MS = 60_000;
const TICKER_MAX_STALE_MS = 5 * 60_000;
const BID_ASK_WETH_NOTIONAL = 10n ** 16n;

type TickerPayload = readonly [ReturnType<typeof coinGeckoTicker>];

let tickerCache: Readonly<{ value: TickerPayload; fetchedAt: number }> | null = null;
let tickerInFlight: Promise<Readonly<{ value: TickerPayload; fetchedAt: number }>> | null = null;

function mainnetLaunch(): LaunchDeployment {
  const launch = deploymentRegistry().find(
    (option) => option.descriptor.deploymentId === ROBINHOOD_GENESIS_DEPLOYMENT_ID
  )?.launch;
  if (!launch?.analytics) throw new Error("The reviewed Robinhood launch manifest is unavailable.");
  return launch;
}

export function coinGeckoSpotMarket(): CoinGeckoSpotMarket {
  const deployment = mainnetLaunch();
  return {
    tickerId: coinGeckoTickerId(deployment.contracts.statics, deployment.contracts.weth),
    baseCurrency: deployment.contracts.statics,
    targetCurrency: deployment.contracts.weth,
    poolId: deployment.market.poolId,
    staticsIsCurrency0:
      deployment.market.poolKey.currency0.toLowerCase() ===
      deployment.contracts.statics.toLowerCase(),
  };
}

export async function loadCoinGeckoSupply() {
  return loadMarketSupplySnapshot();
}

function isUnsigned(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function validIndexedTrade(value: unknown): value is IndexedMarketTrade {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const primitivesValid =
    typeof row.poolId === "string" &&
    isHex(row.poolId, { strict: true }) &&
    size(row.poolId) === 32 &&
    typeof row.transactionHash === "string" &&
    isHex(row.transactionHash, { strict: true }) &&
    size(row.transactionHash) === 32 &&
    [
      "amount0",
      "amount1",
      "volume0",
      "volume1",
      "price1Per0Wad",
      "blockNumber",
      "blockTimestamp",
    ].every((key) =>
      key === "amount0" || key === "amount1"
        ? typeof row[key] === "string" && /^-?\d+$/.test(row[key])
        : isUnsigned(row[key])
    ) &&
    typeof row.logIndex === "number" &&
    Number.isSafeInteger(row.logIndex) &&
    row.logIndex >= 0;
  if (!primitivesValid) return false;
  const amount0 = BigInt(row.amount0 as string);
  const amount1 = BigInt(row.amount1 as string);
  const volume0 = BigInt(row.volume0 as string);
  const volume1 = BigInt(row.volume1 as string);
  return (
    amount0 !== 0n &&
    amount1 !== 0n &&
    (amount0 < 0n ? -amount0 : amount0) === volume0 &&
    (amount1 < 0n ? -amount1 : amount1) === volume1 &&
    BigInt(row.price1Per0Wad as string) > 0n
  );
}

async function loadIndexedTrades(
  query: Readonly<{
    limit: number;
    from?: string;
    to?: string;
    amount0Sign?: "positive" | "negative";
  }>
) {
  const url = staticsMainnetIndexerUrl("market/trades");
  url.searchParams.set("limit", String(query.limit));
  url.searchParams.set("pool", coinGeckoSpotMarket().poolId);
  if (query.from !== undefined) url.searchParams.set("from", query.from);
  if (query.to !== undefined) url.searchParams.set("to", query.to);
  if (query.amount0Sign !== undefined) url.searchParams.set("amount0Sign", query.amount0Sign);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });
  const payload: unknown = response.ok ? await response.json() : null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The indexed market trade response is unavailable.");
  }
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items) || !items.every(validIndexedTrade)) {
    throw new Error("The indexed market trade response is invalid.");
  }
  const market = coinGeckoSpotMarket();
  if (items.some((item) => item.poolId.toLowerCase() !== market.poolId.toLowerCase())) {
    throw new Error("The indexer returned a trade outside the canonical market.");
  }
  return items;
}

async function quoteBidAsk(overview: Awaited<ReturnType<typeof loadMarketSpotOverview>>) {
  const deployment = mainnetLaunch();
  const client = createPublicClient({
    transport: http(robinhoodRpcUrl(deployment.descriptor.chainId)),
  });
  const staticsInput = (BID_ASK_WETH_NOTIONAL * BigInt(overview.price.staticsPerWethWad)) / WAD;
  const quote = async (zeroForOne: boolean, amountIn: bigint): Promise<bigint | null> => {
    if (amountIn <= 0n || amountIn > (1n << 128n) - 1n) return null;
    try {
      const result = await client.simulateContract({
        address: deployment.contracts.quoter,
        abi: v4QuoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            poolKey: poolKeyForLaunch(deployment),
            zeroForOne,
            exactAmount: amountIn,
            hookData: "0x",
          },
        ],
        blockNumber: BigInt(overview.asOfBlock),
      });
      return result.result[0] > 0n ? result.result[0] : null;
    } catch {
      return null;
    }
  };
  const [askStaticsOutput, bidWethOutput] = await Promise.all([
    quote(zeroForTrade(deployment, "weth"), BID_ASK_WETH_NOTIONAL),
    quote(zeroForTrade(deployment, "statics"), staticsInput),
  ]);
  return {
    askWethPerStaticsWad:
      askStaticsOutput === null ? null : (BID_ASK_WETH_NOTIONAL * WAD) / askStaticsOutput,
    bidWethPerStaticsWad:
      bidWethOutput === null || staticsInput === 0n ? null : (bidWethOutput * WAD) / staticsInput,
  } as const;
}

async function refreshTicker(now: number) {
  const overview = await loadMarketSpotOverview(now);
  const [quote, fallbackTrades] = await Promise.all([
    quoteBidAsk(overview),
    overview.activity24h.lastWethPerStaticsWad === null
      ? loadIndexedTrades({ limit: 1 })
      : Promise.resolve([]),
  ]);
  const market = coinGeckoSpotMarket();
  const fallbackPrice = fallbackTrades[0]
    ? canonicalWethPerStaticsFromPrice1Per0(
        BigInt(fallbackTrades[0].price1Per0Wad),
        market.staticsIsCurrency0
      )
    : null;
  const value = [coinGeckoTicker(overview, market, quote, fallbackPrice)] as const;
  return { value, fetchedAt: now } as const;
}

export async function loadCoinGeckoTickers(now = Date.now()): Promise<TickerPayload> {
  if (tickerCache && now - tickerCache.fetchedAt <= TICKER_TTL_MS) return tickerCache.value;
  if (!tickerInFlight) {
    tickerInFlight = refreshTicker(now)
      .then((result) => {
        tickerCache = result;
        return result;
      })
      .finally(() => {
        tickerInFlight = null;
      });
  }
  try {
    return (await tickerInFlight).value;
  } catch (error) {
    if (tickerCache && now - tickerCache.fetchedAt <= TICKER_MAX_STALE_MS) {
      return tickerCache.value;
    }
    throw error;
  }
}

export async function loadCoinGeckoHistoricalTrades(
  query: Readonly<{
    limit: number;
    from?: string;
    to?: string;
    side?: CoinGeckoTradeSide;
  }>
) {
  const market = coinGeckoSpotMarket();
  const amount0Sign =
    query.side === undefined
      ? undefined
      : (query.side === "buy") === market.staticsIsCurrency0
        ? "negative"
        : "positive";
  const trades = await loadIndexedTrades({ ...query, amount0Sign });
  return coinGeckoHistoricalTrades(trades, market, query.side);
}

export async function loadCoinGeckoStatus(now = Date.now()) {
  const [overview, indexerResponse] = await Promise.all([
    loadMarketSpotOverview(now),
    fetch(staticsMainnetIndexerUrl("status"), {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    }),
  ]);
  if (!overview.activity24h.available) throw new Error("Indexed market activity is unavailable.");
  const indexer: unknown = indexerResponse.ok ? await indexerResponse.json() : null;
  const active =
    indexer && typeof indexer === "object" && !Array.isArray(indexer)
      ? (indexer as { active?: unknown }).active
      : null;
  const block =
    active && typeof active === "object" && !Array.isArray(active)
      ? (active as { block?: unknown }).block
      : null;
  if (
    !active ||
    typeof active !== "object" ||
    Array.isArray(active) ||
    (active as { id?: unknown }).id !== overview.chainId ||
    !block ||
    typeof block !== "object" ||
    Array.isArray(block) ||
    typeof (block as { number?: unknown }).number !== "number" ||
    !Number.isSafeInteger((block as { number: number }).number) ||
    (block as { number: number }).number < 0 ||
    typeof (block as { timestamp?: unknown }).timestamp !== "number" ||
    !Number.isSafeInteger((block as { timestamp: number }).timestamp) ||
    (block as { timestamp: number }).timestamp < 0
  ) {
    throw new Error("The indexer status response is unavailable or invalid.");
  }
  const indexedBlock = (block as { number: number; timestamp: number }).number;
  const indexedTimestamp = (block as { number: number; timestamp: number }).timestamp;
  const indexedAt = overview.activity24h.lastTradeAt;
  return {
    ok: true,
    chain_id: overview.chainId,
    deployment_id: overview.deploymentId,
    rpc_as_of_block: overview.asOfBlock,
    indexed_block: String(indexedBlock),
    indexed_at: new Date(indexedTimestamp * 1_000).toISOString(),
    last_trade_at: indexedAt,
    observed_at: new Date(now).toISOString(),
    lag_seconds: Math.max(0, Math.floor(now / 1_000) - indexedTimestamp),
  } as const;
}

export function resetCoinGeckoMarketCacheForTest(): void {
  tickerCache = null;
  tickerInFlight = null;
}
