"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  AllocationDirectoryChangedError,
  loadAllocationDirectory,
  type AllocationDirectoryPage,
  type IndexedAllocationPool,
} from "@/lib/indexer/phase-one";
import { discoverPhaseOnePool, mergePhaseOnePools } from "@/lib/phase-one/pool-discovery";

export const discoveryRoot = "phase-one-pools";

/** Read all indexed public pools sequentially, without mixing directory revisions. */
export async function loadSwapPools(
  deploymentId: string,
  loadPage: typeof loadAllocationDirectory = loadAllocationDirectory,
  signal?: AbortSignal
): Promise<IndexedAllocationPool[]> {
  const pools: IndexedAllocationPool[] = [];
  const cursors = new Set<string>();
  const ids = new Set<string>();
  let cursor: string | undefined;
  let revision: bigint | undefined;
  do {
    signal?.throwIfAborted();
    const page: AllocationDirectoryPage = await loadPage({
      deploymentId,
      filters: { eligible: "all", sort: "created", direction: "asc", limit: 100, cursor },
    });
    signal?.throwIfAborted();
    if (revision !== undefined && revision !== page.directoryRevision)
      throw new AllocationDirectoryChangedError();
    revision = page.directoryRevision;
    for (const pool of page.items) {
      const id = pool.poolId.toLowerCase();
      if (ids.has(id)) throw new Error("The pool directory returned a duplicate pool.");
      ids.add(id);
      pools.push(pool);
    }
    cursor = page.nextCursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw new Error("The pool directory repeated a cursor.");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return pools;
}

/**
 * The indexer supplies registered PoolKeys, cached metadata and current lifecycle flags.
 * Discovery performs no contract reads and does not wait on gauge or reward preflight.
 */
export function usePhaseOnePools(deployment: PhaseOneDeployment | null) {
  const id = deployment?.descriptor.deploymentId ?? "none";
  const indexed = useQuery({
    queryKey: [discoveryRoot, id, "indexed"],
    enabled: Boolean(deployment),
    staleTime: 60_000,
    retry: (failureCount, error) =>
      error instanceof AllocationDirectoryChangedError && failureCount < 1,
    queryFn: ({ signal }) => loadSwapPools(id, loadAllocationDirectory, signal),
  });
  const supported = deployment?.supportedPools;
  const hook = deployment?.contracts.publicHook;
  const pools = useMemo(() => {
    const discovered = (indexed.data ?? []).flatMap((pool) => {
      if (!hook) return [];
      const result = discoverPhaseOnePool(pool, hook);
      return typeof result === "object" ? [result] : [];
    });
    return supported ? mergePhaseOnePools(supported, discovered, indexed.data) : [];
  }, [supported, hook, indexed.data]);
  return { pools, discovering: indexed.isLoading };
}
