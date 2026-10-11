"use client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { staticsAbi, staticsGaugeIncentivesAbi } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  loadIndexedManagedLiquidity,
  loadIndexedPhaseOnePosition,
  loadPositionStatement,
} from "@/lib/indexer/phase-one";
import { readPublicLiquidityFees } from "@/lib/phase-one/liquidity";
import { liquidityHoldings, summarizeAccount, type AccountAsset } from "@/lib/positions/accounts";
import { closeChecklist } from "@/lib/positions/account-close";
import { claimScopeIncomplete, scopeRewardAmounts } from "@/lib/rewards/earn";
import { staleAllocation, type EarnPositionRow } from "@/lib/rewards/position-table";
import { boundedGaugeRead, liquidityLegQuery } from "@/lib/rewards/gauge-reads";
import { ACCOUNT_REWARD_SOURCES } from "./useAccounts";
import { mergeEarnRewardSources, useEarnRewardSources } from "./useEarnPortfolio";
import { usePhaseOneAction } from "./usePhaseOneAction";
import { usePoolValuation } from "./usePoolValuation";

/** One account's balances, earning state, rewards and what still blocks closing it. */
export function useAccount(deployment: PhaseOneDeployment, positionId: bigint) {
  const id = deployment.descriptor.deploymentId;
  const action = usePhaseOneAction(deployment, `account:${positionId}`);
  const position = useQuery({
    queryKey: ["phase-one-position", id, action.wallet, String(positionId), "detail"],
    enabled: Boolean(action.wallet),
    retry: false,
    queryFn: () => loadIndexedPhaseOnePosition(positionId, id),
  });
  const owned =
    Boolean(position.data && action.wallet) &&
    position.data!.owner.toLowerCase() === action.wallet!.toLowerCase();
  const items = owned && position.data ? [position.data] : [];
  // The first statement entry dates the account; the statement section pages the rest.
  const opened = useQuery({
    queryKey: ["phase-one-statement", id, String(positionId), "opened"],
    enabled: owned,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const page = await loadPositionStatement({
        deploymentId: id,
        positionId,
        filters: { direction: "asc", limit: 1 },
      });
      return page.historyStart.openingObserved ? (page.items[0]?.timestamp ?? null) : null;
    },
  });

  // This screen needs allocation locks and selected-asset counts, not selection timing/limits.
  const staking = useQuery({
    queryKey: ["phase-one-position", id, action.wallet, String(positionId), "account-staking"],
    enabled: action.ready && owned,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const [selectedAssets, allocations] = await Promise.all([
        boundedGaugeRead(action.publicClient!, () =>
          action.publicClient!.readContract({
            address: deployment.contracts.diamond,
            abi: staticsAbi,
            functionName: "positionRewardAssets",
            args: [positionId],
            account: action.wallet!,
          })
        ),
        boundedGaugeRead(action.publicClient!, () =>
          action.publicClient!.readContract({
            address: deployment.contracts.diamond,
            abi: staticsGaugeIncentivesAbi,
            functionName: "gaugePositionAllocations",
            args: [positionId],
            account: action.wallet!,
          })
        ),
      ]);
      return {
        selectedAssets,
        allocation: {
          nextAllocationAt: BigInt(allocations[0]),
          totalAllocated: allocations[1],
          poolCount: allocations[2].length,
          lockedStake: allocations[3],
        },
      };
    },
  });
  const clock = useQuery({
    queryKey: [
      "phase-one-position",
      id,
      action.wallet,
      "earn-clock",
      deployment.descriptor.chainId,
    ],
    enabled: action.ready && owned,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => (await action.publicClient!.getBlock({ blockTag: "latest" })).timestamp,
  });
  const row: EarnPositionRow | undefined = position.data
    ? {
        positionId,
        stakedBalance: position.data.stakedBalance,
        liquidityLegs: position.data.activeLegCount,
        selectedAssets: staking.data?.selectedAssets,
        allocation: staking.data?.allocation,
        unavailable: staking.isError,
      }
    : undefined;
  const rewardQueries = useEarnRewardSources(deployment, items, ACCOUNT_REWARD_SOURCES);
  const rewardRows = mergeEarnRewardSources(rewardQueries);
  const scope = { sources: ACCOUNT_REWARD_SOURCES, positionId };
  const rewardsBySource = {
    staking: scopeRewardAmounts(rewardRows, { sources: ["global"], positionId }),
    liquidity: scopeRewardAmounts(rewardRows, { sources: ["gauge", "lp-bribe"], positionId }),
    allocations: scopeRewardAmounts(rewardRows, { sources: ["allocator"], positionId }),
  };
  const rewards = scopeRewardAmounts(rewardRows, scope);
  const rewardsLoading = owned && rewardQueries.some((query) => query.isLoading);
  const rewardsIncomplete =
    rewardQueries.some((query) => query.isError) || claimScopeIncomplete(rewardRows, scope);

  const legs = useQuery({
    queryKey: [
      "phase-one-liquidity-catalog",
      id,
      action.wallet,
      "account",
      String(positionId),
      String(position.data?.updatedAtBlock ?? ""),
    ],
    enabled: action.ready && owned && (position.data?.activeLegCount ?? 0n) > 0n,
    staleTime: 30_000,
    retry: false,
    queryFn: () => loadIndexedManagedLiquidity(positionId, id, action.wallet!),
  });
  const live = (legs.data ?? []).filter((leg) => leg.liquidity > 0n);
  const exited = (legs.data ?? []).filter((leg) => leg.liquidity === 0n);
  const retained = useQueries({
    queries: exited.map((leg) => ({
      ...liquidityLegQuery({
        publicClient: action.publicClient!,
        deployment,
        account: action.wallet,
        positionId,
        poolId: leg.poolId,
      }),
      enabled: action.ready && owned && (position.data?.activeLegCount ?? 0n) > 0n,
    })),
  });
  const unresolvedLiquidityPools = exited.flatMap((leg, index) => {
    const stored = retained[index]?.data;
    return stored &&
      (stored.claimable.some((amount) => amount > 0n) ||
        stored.rewardRemainderRay.some((amount) => amount > 0n))
      ? [leg.poolId]
      : [];
  });
  const valuation = usePoolValuation(
    deployment,
    action,
    live.map((leg) => leg.poolId)
  );
  const fees = useQueries({
    queries: live.map((leg) => ({
      queryKey: [
        "phase-one-liquidity-fees",
        id,
        action.wallet,
        String(positionId),
        leg.poolId,
        String(leg.posmTokenId),
      ],
      enabled: action.ready,
      retry: false,
      staleTime: 15_000,
      queryFn: () =>
        readPublicLiquidityFees({
          publicClient: action.publicClient!,
          deployment,
          ...leg,
          read: (call) => boundedGaugeRead(action.publicClient!, call),
        }),
    })),
  });
  const liquidity = live.map((leg, index) => {
    const tokens = valuation.tokensOf(leg.poolId);
    const held = tokens
      ? liquidityHoldings({
          ...leg,
          token0: tokens[0],
          token1: tokens[1],
          state: valuation.stateOf(leg.poolId),
        })
      : null;
    return {
      leg,
      tokens,
      held,
      fees: fees[index]?.data,
      feesLoading: fees[index]?.isLoading,
      feesUnavailable: fees[index]?.isError,
    };
  });

  const stakingAsset: AccountAsset = {
    address: deployment.contracts.statics,
    symbol: "STATICS",
    decimals: 18,
  };
  const summary = position.data
    ? summarizeAccount({
        positionId,
        stakedBalance: position.data.stakedBalance,
        activeLegCount: position.data.activeLegCount,
        unresolvedObligationCount: position.data.unresolvedObligationCount,
        stakingAsset,
        liquidity: liquidity.flatMap(({ leg, tokens }) =>
          tokens
            ? [
                {
                  ...leg,
                  token0: tokens[0],
                  token1: tokens[1],
                  state: valuation.stateOf(leg.poolId),
                },
              ]
            : []
        ),
        liquidityCount: live.length,
        liquidityComplete:
          (position.data.activeLegCount === 0n || legs.data !== undefined) &&
          liquidity.every((entry) => entry.tokens),
        allocated: row?.allocation?.lockedStake,
        staleAllocation: row ? staleAllocation(row) : undefined,
        rewardsReady: rewards.some((entry) => entry.amount > 0n),
      })
    : undefined;
  const loaded =
    Boolean(position.data) &&
    !legs.isLoading &&
    !staking.isLoading &&
    !retained.some((query) => query.isLoading) &&
    Boolean(row?.allocation && row.selectedAssets) &&
    !rewardsLoading;
  const close = position.data
    ? closeChecklist({
        activeLegCount: position.data.activeLegCount,
        unresolvedObligationCount: position.data.unresolvedObligationCount,
        stakedBalance: position.data.stakedBalance,
        totalAllocated: row?.allocation?.totalAllocated ?? 0n,
        selectedAssets: row?.selectedAssets?.length ?? 0,
        liquidityPools: live.map((leg) => leg.poolId),
        unresolvedLiquidityPools,
        rewardsClaimable: rewards.some((entry) => entry.amount > 0n),
        loaded,
      })
    : undefined;

  return {
    action,
    position,
    owned,
    openedAt: opened.data ?? null,
    row,
    now: clock.data,
    stakingUnavailable: staking.isError,
    summary,
    liquidity,
    liquidityLoading: legs.isLoading || valuation.loading,
    liquidityUnavailable: legs.isError || valuation.unavailable,
    rewardRows,
    rewards,
    rewardsBySource,
    rewardsLoading,
    rewardsIncomplete,
    rewardScope: scope,
    close,
  };
}
