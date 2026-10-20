"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { loadDexDepth, loadDexPools, loadDexTokens, quoteValue } from "@/lib/indexer/dex-market";
import { loadPhaseOneCandles } from "@/lib/indexer/phase-one";
import { priceFromSqrt } from "@/lib/phase-one/liquidity-preview";
import { dexRoot } from "@/hooks/useDexOverview";

export type ChartPeriod = "1D" | "1W" | "1M";
const PERIODS: Record<ChartPeriod, { seconds: number; resolution: 15 | 60 | 240 }> = {
  "1D": { seconds: 86_400, resolution: 15 },
  "1W": { seconds: 7 * 86_400, resolution: 60 },
  "1M": { seconds: 30 * 86_400, resolution: 240 },
};

/**
 * Indexed market context for one pool's liquidity screen: stats, ≈ $ token prices, tick depth
 * and recent prices. Every part is optional; the screen works from chain state without them.
 */
export function usePoolMarket(
  deploymentId: string,
  poolId: Hex,
  decimals: readonly [number, number],
  period: ChartPeriod
) {
  const common = { retry: false, staleTime: 30_000 } as const;
  const stats = useQuery({
    ...common,
    queryKey: [dexRoot, deploymentId, "pool", poolId],
    queryFn: async () => {
      const page = await loadDexPools(deploymentId, "usdg", { search: poolId, limit: 1 });
      return {
        pool: page.items.find((pool) => pool.poolId.toLowerCase() === poolId.toLowerCase()) ?? null,
        quote: page.quote,
        indexedAtTimestamp: page.indexedAtTimestamp,
      };
    },
  });
  const tokens = useQuery({
    ...common,
    queryKey: [dexRoot, deploymentId, "tokens", "usdg"],
    queryFn: () => loadDexTokens(deploymentId, "usdg"),
  });
  const depth = useQuery({
    ...common,
    queryKey: [dexRoot, deploymentId, "depth", poolId],
    queryFn: () => loadDexDepth(deploymentId, poolId),
  });
  const observedTime = depth.data?.indexedAtTimestamp ?? stats.data?.indexedAtTimestamp;
  const candles = useQuery({
    ...common,
    queryKey: [
      dexRoot,
      deploymentId,
      "candles",
      poolId,
      period,
      ...decimals,
      observedTime?.toString(),
    ],
    enabled: observedTime !== undefined,
    queryFn: async () => {
      const to = Number(observedTime!);
      const from = Math.max(0, to - PERIODS[period].seconds);
      const page = await loadPhaseOneCandles({
        deploymentId,
        poolId,
        from: BigInt(from),
        to: BigInt(to),
        resolution: PERIODS[period].resolution,
      });
      return {
        from,
        to,
        items: page.items.map((candle) => ({
          timestamp: candle.timestamp,
          open: priceFromSqrt(candle.openSqrtPriceX96, decimals[0], decimals[1]),
          close: priceFromSqrt(candle.closeSqrtPriceX96, decimals[0], decimals[1]),
        })),
      };
    },
  });
  /** ≈ $ value of a raw token amount, or null when the token has no indexed price. */
  const usd = (token: Address, amount: bigint, tokenDecimals: number): number | null => {
    const quote = tokens.data;
    if (quote?.quote.kind !== "usdg") return null;
    const entry = quote?.items.find(
      (item) => item.token.address.toLowerCase() === token.toLowerCase()
    );
    return quote && entry && quote.quote.decimals !== null
      ? quoteValue(entry, amount, tokenDecimals, quote.quote.decimals)
      : null;
  };
  return {
    stats: stats.data?.pool ?? null,
    statsQuote: stats.data?.quote ?? null,
    depth: depth.data ?? null,
    candles: candles.data ?? null,
    usd,

    hasPrices: Boolean(tokens.data),
  };
}
