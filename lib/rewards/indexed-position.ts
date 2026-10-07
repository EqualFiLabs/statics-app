import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import {
  loadIndexedPhaseOnePositions,
  type IndexedPhaseOnePosition,
  type PhaseOneIndexedPage,
} from "@/lib/indexer/phase-one";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";

/**
 * Ownership comes from the indexer, which can trail a confirmed transaction by a few blocks.
 * Refetch the wallet's position list until the new position is indexed, instead of refreshing
 * once and leaving the old list on screen until a reload.
 */
export async function waitForIndexedPosition(input: {
  queryClient: QueryClient;
  deploymentId: string;
  wallet: Address;
  positionId: bigint;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<boolean> {
  const key = protocolQueryKeys.phaseOnePositions(input.deploymentId, input.wallet);
  const deadline = Date.now() + (input.timeoutMs ?? 60_000);
  for (;;) {
    await input.queryClient.refetchQueries({ queryKey: key, exact: true });
    const data =
      input.queryClient.getQueryData<InfiniteData<PhaseOneIndexedPage<IndexedPhaseOnePosition>>>(
        key
      );
    if (data?.pages.some((page) => page.items.some((item) => item.positionId === input.positionId)))
      return true;
    // Refetching an infinite query only refreshes pages already loaded. Follow the
    // remaining cursors so a freshly minted NFT beyond those pages can appear.
    const visited = new Set<string>();
    let cursor = data?.pages.at(-1)?.nextCursor;
    while (cursor && Date.now() < deadline) {
      if (visited.has(cursor)) return false;
      visited.add(cursor);
      let page: PhaseOneIndexedPage<IndexedPhaseOnePosition>;
      try {
        page = await loadIndexedPhaseOnePositions(
          input.wallet,
          input.deploymentId,
          undefined,
          cursor
        );
      } catch {
        // Discovery failure cannot turn a confirmed transaction into a failed one.
        return false;
      }
      const requestedCursor = cursor;
      const next = input.queryClient.setQueryData<
        InfiniteData<PhaseOneIndexedPage<IndexedPhaseOnePosition>>
      >(key, (current) => {
        if (!current || current.pages.at(-1)?.nextCursor !== requestedCursor) return current;
        return {
          pages: [...current.pages, page],
          pageParams: [...current.pageParams, requestedCursor],
        };
      });
      if (
        next?.pages.some((entry) =>
          entry.items.some((item) => item.positionId === input.positionId)
        )
      )
        return true;
      cursor = next?.pages.at(-1)?.nextCursor;
    }
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, input.intervalMs ?? 1_500));
  }
}
