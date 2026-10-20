"use client";
import { useQueries } from "@tanstack/react-query";
import type { Hex } from "viem";
import { v4StateViewReadAbi } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { AccountAsset } from "@/lib/positions/accounts";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { boundedGaugeRead } from "@/lib/rewards/gauge-reads";
import { useAllocationPools } from "./useAllocationDirectory";
import type { usePhaseOneAction } from "./usePhaseOneAction";

type Action = ReturnType<typeof usePhaseOneAction>;

/**
 * Token metadata and current price for the pools an account's liquidity sits in. Pools in the
 * reviewed manifest use its metadata; others take it from the indexer's directory.
 */
export function usePoolValuation(
  deployment: PhaseOneDeployment,
  action: Action,
  pools: readonly Hex[]
) {
  const id = deployment.descriptor.deploymentId;
  const poolIds = [...new Map(pools.map((poolId) => [poolId.toLowerCase(), poolId])).values()];
  const manifest = (poolId: Hex) =>
    deployment.supportedPools.find((pool) => pool.poolId.toLowerCase() === poolId.toLowerCase());
  const directory = useAllocationPools(
    deployment,
    poolIds.filter((poolId) => !manifest(poolId))
  );
  const tokensOf = (poolId: Hex): readonly [AccountAsset, AccountAsset] | undefined => {
    const listed = manifest(poolId);
    if (listed) return [listed.token0, listed.token1];
    const indexed = directory.poolOf(poolId);
    if (!indexed) return undefined;
    const asset = (token: typeof indexed.token0): AccountAsset => ({
      address: token.address,
      symbol: token.symbol ?? token.address.slice(0, 6),
      decimals: token.decimals,
    });
    return [asset(indexed.token0), asset(indexed.token1)];
  };
  const states = useQueries({
    queries: poolIds.map((poolId) => ({
      queryKey: protocolQueryKeys.phaseOnePool(id, poolId),
      enabled: action.ready,
      staleTime: 15_000,
      retry: false,
      queryFn: async () => {
        const [sqrtPriceX96, tick] = await boundedGaugeRead(action.publicClient!, () =>
          action.publicClient!.readContract({
            address: deployment.contracts.stateView,
            abi: v4StateViewReadAbi,
            functionName: "getSlot0",
            args: [poolId],
          })
        );
        return { sqrtPriceX96, tick };
      },
    })),
  });
  return {
    tokensOf,
    stateOf: (poolId: Hex) =>
      states[poolIds.findIndex((entry) => entry.toLowerCase() === poolId.toLowerCase())]?.data,
    loading: directory.loading || states.some((query) => query.isLoading),
    unavailable: directory.unavailable || states.some((query) => query.isError),
  };
}
