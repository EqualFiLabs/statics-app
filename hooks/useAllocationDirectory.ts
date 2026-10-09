"use client";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { staticsGaugeIncentivesAbi } from "@statics-protocol/sdk/phase-one";
import type { Hex } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  AllocationDirectoryChangedError,
  loadAllocationDirectory,
  type AllocationDirectoryFilters,
  type IndexedAllocationPool,
} from "@/lib/indexer/phase-one";
import type { usePhaseOneAction } from "./usePhaseOneAction";

type Action = ReturnType<typeof usePhaseOneAction>;
export const allocationDirectoryRoot = "phase-one-allocation-directory";

/**
 * The indexer's pool directory, paged with its own cursors. Pages from different directory
 * revisions are never joined: when the directory changes mid-paging the caller sees `changed`
 * and restarts from the first page with `restart()`.
 */
export function useAllocationDirectory(
  deployment: PhaseOneDeployment,
  filters: Omit<AllocationDirectoryFilters, "cursor">
) {
  const id = deployment.descriptor.deploymentId;
  const query = useInfiniteQuery({
    queryKey: [allocationDirectoryRoot, id, "page", filters],
    initialPageParam: null as string | null,
    retry: false,
    staleTime: 15_000,
    queryFn: ({ pageParam }) =>
      loadAllocationDirectory({
        deploymentId: id,
        filters: { ...filters, ...(pageParam ? { cursor: pageParam } : {}) },
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const pages = query.data?.pages ?? [];
  return {
    pools: pages.flatMap((page) => page.items),
    total: pages[0]?.total,
    reserve: pages[0]?.reserve ?? null,
    indexedAtTimestamp: pages[0]?.indexedAtTimestamp ?? null,
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => void query.fetchNextPage(),
    changed: query.error instanceof AllocationDirectoryChangedError,
    unavailable: query.isError && !(query.error instanceof AllocationDirectoryChangedError),
    restart: () => void query.refetch(),
  };
}

/** Directory entries for specific pools (the ones a wallet already allocates to). */
export function useAllocationPools(deployment: PhaseOneDeployment, poolIds: readonly Hex[]) {
  const id = deployment.descriptor.deploymentId;
  const unique = [...new Map(poolIds.map((poolId) => [poolId.toLowerCase(), poolId])).values()];
  const queries = useQueries({
    queries: unique.map((poolId) => ({
      queryKey: [allocationDirectoryRoot, id, "pool", poolId.toLowerCase()],
      staleTime: 15_000,
      retry: false,
      queryFn: async () => {
        // Pool IDs are searchable; include ineligible pools so stale allocations resolve.
        const page = await loadAllocationDirectory({
          deploymentId: id,
          filters: { search: poolId, eligible: "all", limit: 5 },
        });
        return {
          pool:
            page.items.find((pool) => pool.poolId.toLowerCase() === poolId.toLowerCase()) ?? null,
          reserve: page.reserve,
        };
      },
    })),
  });
  const byId = new Map<string, IndexedAllocationPool>(
    queries.flatMap((query) =>
      query.data?.pool ? [[query.data.pool.poolId.toLowerCase(), query.data.pool] as const] : []
    )
  );
  return {
    poolOf: (poolId: Hex) => byId.get(poolId.toLowerCase()),
    /** The directory's reserve observation (same for every pool). */
    reserve: queries.find((query) => query.data)?.data?.reserve ?? null,
    loading: queries.some((query) => query.isLoading),
    unavailable: queries.some((query) => query.isError),
  };
}

/** Live contract limits for allocation edits: the cooldown length and per-position pool cap. */
export function useAllocationRules(deployment: PhaseOneDeployment, action: Action) {
  const id = deployment.descriptor.deploymentId;
  return useQuery({
    queryKey: ["phase-one-gauges", id, action.wallet, "allocation-rules"],
    enabled: action.ready,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const client = action.publicClient!,
        address = deployment.contracts.diamond;
      const [cooldown, maximumAllocations] = await Promise.all([
        client.readContract({
          address,
          abi: staticsGaugeIncentivesAbi,
          functionName: "gaugeAllocationCooldown",
        }),
        client.readContract({
          address,
          abi: staticsGaugeIncentivesAbi,
          functionName: "maxGaugeAllocationsPerPosition",
        }),
      ]);
      return { cooldown: BigInt(cooldown), maximumAllocations };
    },
  });
}
