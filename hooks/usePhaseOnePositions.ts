"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { loadIndexedPhaseOnePositions } from "@/lib/indexer/phase-one";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";

export function usePhaseOnePositions(deploymentId: string, wallet: Address | null) {
  const query = useInfiniteQuery({
    queryKey: protocolQueryKeys.phaseOnePositions(deploymentId, wallet),
    enabled: Boolean(wallet),
    retry: false,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      if (!wallet) throw new Error("Connect a wallet to load positions.");
      return loadIndexedPhaseOnePositions(wallet, deploymentId, undefined, pageParam);
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const items = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((position) => [position.positionId.toString(), position]) ?? []
    ).values(),
  ];
  return { ...query, items };
}
