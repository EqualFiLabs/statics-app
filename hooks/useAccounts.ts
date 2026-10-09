"use client";
import { useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import type { Hex } from "viem";
import { staticsGaugeIncentivesAbi, v4StateViewReadAbi } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { loadIndexedManagedLiquidity } from "@/lib/indexer/phase-one";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { claimScopeIncomplete, scopeRewardAmounts } from "@/lib/rewards/earn";
import { boundedGaugeRead } from "@/lib/rewards/gauge-reads";
import {
  summarizeAccount,
  type AccountAsset,
  type AccountLiquidity,
  type AccountSummary,
} from "@/lib/positions/accounts";
import { useAllocationPools } from "./useAllocationDirectory";
import { mergeEarnRewardSources, useEarnRewardSources } from "./useEarnPortfolio";
import { usePhaseOneAction } from "./usePhaseOneAction";
import { usePhaseOnePositions } from "./usePhaseOnePositions";

const ALL_SOURCES = ["global", "gauge", "lp-bribe", "allocator"] as const;

/**
 * Every account (Position NFT) the wallet owns, summarised for the accounts list: what it
 * holds per asset, whether anything needs attention, and whether rewards are waiting. Reuses
 * the Earn reads and the indexer's liquidity entries; pool prices come from the v4 StateView.
 */
export function useAccounts(deployment: PhaseOneDeployment) {
  const id = deployment.descriptor.deploymentId;
  const action = usePhaseOneAction(deployment);
  const positions = usePhaseOnePositions(id, action.wallet);
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = positions;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const allocations = useQueries({
    queries: positions.items.map((position) => ({
      queryKey: [
        "phase-one-position",
        id,
        action.wallet,
        String(position.positionId),
        "accounts-allocation",
      ],
      enabled: action.ready && position.stakedBalance > 0n,
      staleTime: 30_000,
      retry: false,
      queryFn: () =>
        boundedGaugeRead(action.publicClient!, () =>
          action.publicClient!.readContract({
            address: deployment.contracts.diamond,
            abi: staticsGaugeIncentivesAbi,
            functionName: "gaugePositionAllocations",
            args: [position.positionId],
            account: action.wallet!,
          })
        ),
    })),
  });
  const rewardQueries = useEarnRewardSources(deployment, positions.items, ALL_SOURCES);
  const rewardRows = mergeEarnRewardSources(rewardQueries);
  const rewardUnavailable =
    rewardQueries.some((query) => query.isError) ||
    claimScopeIncomplete(rewardRows, { sources: ALL_SOURCES });
  const rewardsLoaded =
    rewardQueries.every((query) => query.data !== undefined) && !rewardUnavailable;

  const withLiquidity = positions.items.filter((position) => position.activeLegCount > 0n);
  const liquidity = useQueries({
    queries: withLiquidity.map((position) => ({
      queryKey: [
        "phase-one-liquidity-catalog",
        id,
        action.wallet,
        "accounts",
        String(position.positionId),
        String(position.updatedAtBlock),
      ],
      enabled: action.ready,
      staleTime: 30_000,
      retry: false,
      queryFn: () => loadIndexedManagedLiquidity(position.positionId, id, action.wallet!),
    })),
  });
  const legsOf = new Map(
    withLiquidity.map((position, index) => [
      String(position.positionId),
      (liquidity[index]?.data ?? []).filter((leg) => leg.liquidity > 0n),
    ])
  );
  const poolIds = [
    ...new Map(
      [...legsOf.values()].flat().map((leg) => [leg.poolId.toLowerCase(), leg.poolId])
    ).values(),
  ];
  // Pools outside the reviewed manifest take token metadata from the indexer's directory.
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
  const stateOf = (poolId: Hex) =>
    states[poolIds.findIndex((entry) => entry.toLowerCase() === poolId.toLowerCase())]?.data;

  const stakingAsset: AccountAsset = {
    address: deployment.contracts.statics,
    symbol: "STATICS",
    decimals: 18,
  };
  const accounts: AccountSummary[] = positions.items.map((position, index) => {
    const allocation = allocations[index]?.data;
    const legs = legsOf.get(String(position.positionId)) ?? [];
    const entries: AccountLiquidity[] = legs.flatMap((leg) => {
      const tokens = tokensOf(leg.poolId);
      if (!tokens) return [];
      return [
        {
          poolId: leg.poolId,
          tickLower: leg.tickLower,
          tickUpper: leg.tickUpper,
          liquidity: leg.liquidity,
          token0: tokens[0],
          token1: tokens[1],
          state: stateOf(leg.poolId),
        },
      ];
    });
    return summarizeAccount({
      positionId: position.positionId,
      stakedBalance: position.stakedBalance,
      activeLegCount: position.activeLegCount,
      unresolvedObligationCount: position.unresolvedObligationCount,
      stakingAsset,
      liquidity: entries,
      liquidityCount: legs.length,
      liquidityComplete:
        (position.activeLegCount === 0n ||
          liquidity[withLiquidity.findIndex((entry) => entry.positionId === position.positionId)]
            ?.data !== undefined) &&
        entries.length === legs.length,
      allocated: allocation?.[3],
      staleAllocation: allocation ? allocation[1] - allocation[3] : undefined,
      rewardsReady: scopeRewardAmounts(rewardRows, {
        sources: ALL_SOURCES,
        positionId: position.positionId,
      }).some((entry) => entry.amount > 0n),
    });
  });
  return {
    action,
    positions,
    accounts,
    loading:
      positions.isLoading ||
      allocations.some((query) => query.isLoading) ||
      directory.loading ||
      Boolean(positions.hasNextPage) ||
      liquidity.some((query) => query.isLoading) ||
      states.some((query) => query.isLoading),
    rewardsLoaded,
    unavailable:
      positions.isError ||
      allocations.some((query) => query.isError) ||
      directory.unavailable ||
      rewardUnavailable ||
      liquidity.some((query) => query.isError) ||
      states.some((query) => query.isError),
  };
}
