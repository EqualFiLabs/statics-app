"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  loadDexEmissions,
  loadDexPools,
  loadDexSummary,
  loadDexTokens,
  loadDexTrades,
  loadDexVolume,
  parseDexEmissions,
  parseDexPools,
  parseDexSummary,
  parseDexTokens,
  parseDexTrades,
  parseDexVolume,
  type DexQuote,
  type DexPoolPage,
} from "@/lib/indexer/dex-market";
import { dexFixture, dexOverviewFixturesEnabled } from "@/lib/indexer/dex-market-fixture";
import { loadIndexedPublicPools } from "@/lib/indexer/phase-one";
import type { HookFeeRate } from "@/lib/phase-one/swap-fees";

export const dexRoot = "phase-one-dex";
const LIVE_MS = 30_000;

/** Market data for the DEX overview, re-read every 30 seconds while the page is open. */
export function useDexOverview(
  deployment: PhaseOneDeployment,
  quote: DexQuote,
  pools: Readonly<{ sort: string; search: string }>,
  days: number
) {
  const id = deployment.descriptor.deploymentId;
  const fixtures = dexOverviewFixturesEnabled();
  const sample = (options: Parameters<typeof dexFixture>[2] = {}) =>
    dexFixture(deployment, quote, options);
  const common = { staleTime: 15_000, retry: false, refetchInterval: LIVE_MS } as const;
  const summary = useQuery({
    ...common,
    queryKey: [dexRoot, id, "summary", quote],
    queryFn: () => (fixtures ? parseDexSummary(sample().summary, id) : loadDexSummary(id, quote)),
  });
  const poolPage = useInfiniteQuery({
    ...common,
    refetchInterval: false,
    queryKey: [dexRoot, id, "pools", quote, pools.sort, pools.search],
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: DexPoolPage) => last.nextCursor ?? undefined,
    queryFn: ({ pageParam }) =>
      fixtures
        ? parseDexPools(sample({ ...pools, limit: 25, cursor: pageParam }).pools, id)
        : loadDexPools(id, quote, { ...pools, limit: 25, cursor: pageParam }),
  });
  const tokens = useQuery({
    ...common,
    queryKey: [dexRoot, id, "tokens", quote],
    queryFn: () => (fixtures ? parseDexTokens(sample().tokens, id) : loadDexTokens(id, quote)),
  });
  const volume = useQuery({
    ...common,
    refetchInterval: false,
    queryKey: [dexRoot, id, "volume", quote, days],
    queryFn: () =>
      fixtures ? parseDexVolume(sample({ days }).volume, id) : loadDexVolume(id, quote, days),
  });
  const emissions = useQuery({
    ...common,
    queryKey: [dexRoot, id, "emissions", quote],
    queryFn: () =>
      fixtures ? parseDexEmissions(sample().emissions, id) : loadDexEmissions(id, quote),
  });
  const trades = useQuery({
    ...common,
    queryKey: [dexRoot, id, "trades", quote],
    queryFn: () => (fixtures ? parseDexTrades(sample().trades, id) : loadDexTrades(id, quote)),
  });
  // Statics-hooked pools charge input and output fees on top of the LP fee; each pool has its own.
  const hookFees = useQuery({
    ...common,
    refetchInterval: false,
    staleTime: 60_000,
    enabled: !fixtures,
    queryKey: [dexRoot, id, "hook-fees"],
    queryFn: async () =>
      new Map<string, HookFeeRate>(
        (await loadIndexedPublicPools(id)).items.map((pool) => [
          pool.poolId.toLowerCase(),
          { inputBps: pool.inputFeeBps, outputBps: pool.outputFeeBps },
        ])
      ),
  });
  return {
    summary,
    pools: {
      ...poolPage,
      data: poolPage.data
        ? { ...poolPage.data.pages[0]!, items: poolPage.data.pages.flatMap((page) => page.items) }
        : undefined,
    },
    tokens,
    volume,
    emissions,
    trades,
    hookFees: hookFees.data ?? null,
    fixtures,
  };
}
