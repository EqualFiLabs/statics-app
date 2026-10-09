"use client";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { loadPositionStatement, StatementHistoryChangedError } from "@/lib/indexer/phase-one";
import type { StatementFilter } from "@/lib/positions/statement";

export const statementRoot = "phase-one-statement";

/**
 * An account's statement, newest first, paged with the indexer's cursors. Pages are pinned to
 * one observation point, so new activity never shifts them; if history changes under the
 * cursor (a reorg), the caller sees `changed` and restarts from the newest page.
 */
export function useAccountStatement(
  deployment: PhaseOneDeployment,
  positionId: bigint,
  filter: StatementFilter,
  enabled: boolean
) {
  const id = deployment.descriptor.deploymentId;
  const queryClient = useQueryClient();
  const queryKey = [statementRoot, id, String(positionId), "page", filter];
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: null as string | null,
    staleTime: 10_000,
    retry: false,
    queryFn: ({ pageParam }) =>
      loadPositionStatement({
        deploymentId: id,
        positionId,
        filters: {
          ...(filter === "all" ? {} : { category: filter }),
          limit: 25,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const pages = query.data?.pages ?? [];
  return {
    items: pages.flatMap((page) => page.items),
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => void query.fetchNextPage(),
    changed: query.error instanceof StatementHistoryChangedError,
    unavailable: query.isError && !(query.error instanceof StatementHistoryChangedError),
    restart: () => void queryClient.resetQueries({ queryKey }),
  };
}
