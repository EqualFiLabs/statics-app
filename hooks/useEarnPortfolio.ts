"use client";
import { useEffect } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { usePhaseOneAction } from "./usePhaseOneAction";
import { usePhaseOnePositions } from "./usePhaseOnePositions";
import {
  loadIndexedAllocationSnapshot,
  type IndexedPhaseOnePosition,
} from "@/lib/indexer/phase-one";
import {
  discoverPositionRewardPools,
  mapRewardReads,
  type PositionRewardPortfolio,
  type RewardSource,
} from "@/lib/phase-one/reward-portfolio";
import { readPositionGlobalRewards } from "@/lib/phase-one/staking";
import { staticsRangeGaugeAbi } from "@statics-protocol/sdk/phase-one";
import { readPositionGaugeRewards } from "@/lib/phase-one/gauges";
import { sourceForView, type EarnView, type EarnFilters } from "@/lib/rewards/earn";

export function useEarnPortfolio(
  deployment: PhaseOneDeployment,
  view: EarnView,
  filters: EarnFilters
) {
  const action = usePhaseOneAction(deployment);
  const positions = usePhaseOnePositions(deployment.descriptor.deploymentId, action.wallet);
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = positions;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  const sources = sourceForView(view, filters.share);
  const rewardPositions = positions.items.filter(
    (position) => filters.positionId === undefined || position.positionId === filters.positionId
  );
  const rewards = useEarnRewardSources(deployment, rewardPositions, sources, filters.poolId);
  const id = deployment.descriptor.deploymentId;
  const allocationQuery = useQueries({
    queries:
      view === "overview" || view === "allocations"
        ? positions.items.map((position) => ({
            queryKey: [
              "phase-one-position",
              id,
              action.wallet,
              String(position.positionId),
              "indexed-allocations",
            ],
            enabled: Boolean(action.wallet),
            staleTime: 30_000,
            retry: false,
            queryFn: () =>
              limitedAllocationRead(() =>
                loadIndexedAllocationSnapshot(position.positionId, id, action.wallet!)
              ),
          }))
        : [],
  });
  return {
    action,
    positions,
    rewards,
    allocations: allocationQuery,
    ownershipLoading:
      positions.isLoading || positions.isFetchingNextPage || Boolean(positions.hasNextPage),
    ownershipIncomplete: positions.isError,
  };
}

export function useEarnRewardSources(
  deployment: PhaseOneDeployment,
  positions: readonly IndexedPhaseOnePosition[],
  sources: readonly RewardSource[],
  poolFilter?: `0x${string}`
) {
  const action = usePhaseOneAction(deployment);
  const cache = useQueryClient(),
    id = deployment.descriptor.deploymentId;
  return useQueries({
    queries: sources.map((source) => ({
      queryKey: [
        "phase-one-rewards",
        id,
        action.wallet,
        "earn-source",
        source,
        positions.map((position) => String(position.positionId)).join(","),
        poolFilter ?? "all",
      ],
      enabled: action.ready && positions.length > 0,
      staleTime: 30_000,
      retry: false,
      queryFn: () =>
        mapRewardReads(positions, async (position): Promise<PositionRewardPortfolio> => {
          const base = {
            publicClient: action.publicClient!,
            deployment,
            account: action.wallet!,
            positionId: position.positionId,
          };
          const empty = {
            loadedSources: [source],
            positionId: position.positionId,
            global: null,
            globalUnavailable: false,
            discoveryUnavailable: false,
            pools: [],
          };
          if (source === "global") {
            try {
              return {
                ...empty,
                global: await cache.fetchQuery({
                  queryKey: [
                    "phase-one-rewards",
                    id,
                    action.wallet,
                    String(position.positionId),
                    "global",
                  ],
                  staleTime: 30_000,
                  retry: false,
                  queryFn: () => boundedEarnRead(() => readPositionGlobalRewards(base)),
                }),
              };
            } catch {
              return { ...empty, globalUnavailable: true };
            }
          }
          const kind = source === "allocator" ? "allocator" : "lp";
          let ids;
          try {
            ids = await cache.fetchQuery({
              queryKey: [
                "phase-one-gauges",
                id,
                action.wallet,
                String(position.positionId),
                "reward-pools",
                kind,
              ],
              staleTime: 60_000,
              retry: false,
              queryFn: () => boundedEarnRead(() => discoverPositionRewardPools({ ...base, kind })),
            });
          } catch {
            return { ...empty, discoveryUnavailable: true };
          }
          const pools = await mapRewardReads(
            ids[kind].filter(
              (poolId) => !poolFilter || poolId.toLowerCase() === poolFilter.toLowerCase()
            ),
            async (poolId) => {
              const entry = { poolId, hasLp: kind === "lp", hasAllocator: kind === "allocator" };
              try {
                return {
                  ...entry,
                  rewards: await cache.fetchQuery({
                    queryKey: [
                      "phase-one-rewards",
                      id,
                      action.wallet,
                      String(position.positionId),
                      poolId,
                      source,
                    ],
                    staleTime: 30_000,
                    retry: false,
                    queryFn: async () => {
                      const config =
                        source === "allocator"
                          ? await cache.fetchQuery({
                              queryKey: [
                                "phase-one-gauges",
                                id,
                                action.wallet,
                                "pool-config",
                                poolId,
                              ],
                              staleTime: 60_000,
                              retry: false,
                              queryFn: () =>
                                boundedEarnRead(() =>
                                  base.publicClient.readContract({
                                    address: deployment.contracts.diamond,
                                    abi: staticsRangeGaugeAbi,
                                    functionName: "poolRewardConfig",
                                    args: [poolId],
                                  })
                                ),
                            })
                          : null;
                      return boundedEarnRead(() =>
                        readPositionGaugeRewards({
                          ...base,
                          poolId,
                          source,
                          allocatorSlots: config
                            ? Array.from(
                                { length: Math.max(0, config.slotCount - 1) },
                                (_, index) => index + 1
                              )
                            : undefined,
                        })
                      );
                    },
                  }),
                };
              } catch {
                return {
                  ...entry,
                  rewards: null,
                  lpUnavailable: kind === "lp",
                  allocatorUnavailable: kind === "allocator",
                };
              }
            }
          );
          return { ...empty, pools };
        }),
    })),
  });
}

export function mergeEarnRewardSources(
  queries: readonly { data?: PositionRewardPortfolio[] }[]
): PositionRewardPortfolio[] {
  const rows = new Map<string, PositionRewardPortfolio>();
  for (const query of queries)
    for (const next of query.data ?? []) {
      const previous = rows.get(String(next.positionId));
      if (!previous) {
        rows.set(String(next.positionId), next);
        continue;
      }
      const pools = new Map(previous.pools.map((pool) => [pool.poolId.toLowerCase(), pool]));
      for (const pool of next.pools) {
        const old = pools.get(pool.poolId.toLowerCase());
        pools.set(
          pool.poolId.toLowerCase(),
          !old
            ? pool
            : {
                ...pool,
                hasLp: pool.hasLp || old.hasLp,
                hasAllocator: pool.hasAllocator || old.hasAllocator,
                lpUnavailable: old.lpUnavailable || pool.lpUnavailable,
                allocatorUnavailable: old.allocatorUnavailable || pool.allocatorUnavailable,
                rewards:
                  old.rewards && pool.rewards
                    ? {
                        lp: pool.hasLp
                          ? {
                              ...pool.rewards.lp,
                              amounts: next.loadedSources?.includes("gauge")
                                ? pool.rewards.lp.amounts
                                : [
                                    old.rewards.lp.amounts[0],
                                    pool.rewards.lp.amounts[1],
                                    pool.rewards.lp.amounts[2],
                                    pool.rewards.lp.amounts[3],
                                    pool.rewards.lp.amounts[4],
                                  ],
                            }
                          : old.rewards.lp,
                        allocator: pool.hasAllocator
                          ? pool.rewards.allocator
                          : old.rewards.allocator,
                      }
                    : (old.rewards ?? pool.rewards),
              }
        );
      }
      rows.set(String(next.positionId), {
        ...next,
        global: next.global ?? previous.global,
        globalUnavailable: previous.globalUnavailable || next.globalUnavailable,
        discoveryUnavailable: previous.discoveryUnavailable || next.discoveryUnavailable,
        pools: [...pools.values()],
      });
    }
  return [...rows.values()];
}

let allocationReads = 0;
const waitingAllocationReads: (() => void)[] = [];
async function limitedAllocationRead<T>(read: () => Promise<T>): Promise<T> {
  if (allocationReads >= 4)
    await new Promise<void>((resolve) => waitingAllocationReads.push(resolve));
  else allocationReads++;
  try {
    return await read();
  } finally {
    const next = waitingAllocationReads.shift();
    if (next) next();
    else allocationReads--;
  }
}

let activeEarnReads = 0;
const waitingEarnReads: (() => void)[] = [];
async function boundedEarnRead<T>(read: () => Promise<T>): Promise<T> {
  if (activeEarnReads >= 4) await new Promise<void>((resolve) => waitingEarnReads.push(resolve));
  else activeEarnReads++;
  try {
    return await read();
  } finally {
    const next = waitingEarnReads.shift();
    if (next) next();
    else activeEarnReads--;
  }
}
