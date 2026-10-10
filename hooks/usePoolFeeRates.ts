"use client";

import { useQuery } from "@tanstack/react-query";
import { loadIndexedPublicPools } from "@/lib/indexer/phase-one";
import type { HookFeeRate } from "@/lib/phase-one/swap-fees";

/** One cached indexer request per deployment, shared by market and liquidity views. */
export function usePoolFeeRates(deploymentId: string, enabled = true) {
  return useQuery({
    queryKey: ["phase-one-pool-fees", deploymentId],
    staleTime: 60_000,
    retry: false,
    enabled,
    queryFn: async () =>
      new Map<string, HookFeeRate>(
        (await loadIndexedPublicPools(deploymentId)).items.map((pool) => [
          pool.poolId.toLowerCase(),
          { inputBps: pool.inputFeeBps, outputBps: pool.outputFeeBps },
        ])
      ),
  });
}
