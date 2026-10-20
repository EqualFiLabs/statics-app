"use client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { staticsAbi, staticsGaugeIncentivesAbi } from "@statics-protocol/sdk/phase-one";
import {
  STATICS_REWARD_SELECTION_TIMING_INTERFACE_ID,
  staticsRewardSelectionTimingAbi,
} from "@statics-protocol/sdk";
import { parseAbi, type Address } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { IndexedPhaseOnePosition } from "@/lib/indexer/phase-one";
import type { EarnPositionRow } from "@/lib/rewards/position-table";
import type { usePhaseOneAction } from "./usePhaseOneAction";

type Action = ReturnType<typeof usePhaseOneAction>;
const interfaceAbi = parseAbi([
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);

/**
 * Per-position staking, reward-asset and allocation state for the Earn table. Each position is
 * one query so a single failed read marks only that row unavailable.
 */
export function useEarnPositionTable(
  deployment: PhaseOneDeployment,
  action: Action,
  positions: readonly IndexedPhaseOnePosition[]
) {
  const id = deployment.descriptor.deploymentId,
    diamond = deployment.contracts.diamond;
  // Fork and chain time can differ from the browser clock; cooldowns and maturity use the chain.
  const clock = useQuery({
    queryKey: [
      "phase-one-position",
      id,
      action.wallet,
      "earn-clock",
      deployment.descriptor.chainId,
    ],
    enabled: action.ready,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => (await action.publicClient!.getBlock({ blockTag: "latest" })).timestamp,
  });
  // Until the chain clock loads, nothing reads as cooling down or maturing.
  const now = clock.data;
  const timing = useQuery({
    queryKey: ["phase-one-selection-timing", deployment.descriptor.chainId, diamond],
    enabled: action.ready && positions.length > 0,
    staleTime: 300_000,
    retry: false,
    queryFn: () =>
      action.publicClient!.readContract({
        address: diamond,
        abi: interfaceAbi,
        functionName: "supportsInterface",
        args: [STATICS_REWARD_SELECTION_TIMING_INTERFACE_ID],
      }),
  });
  const limits = useQuery({
    queryKey: ["phase-one-position", id, "earn-limits", deployment.descriptor.chainId],
    enabled: action.ready,
    staleTime: Infinity,
    retry: false,
    queryFn: () =>
      action.publicClient!.readContract({
        address: diamond,
        abi: staticsAbi,
        functionName: "maxRewardAssetsPerPosition",
      }),
  });
  const details = useQueries({
    queries: positions.map((position) => ({
      queryKey: [
        "phase-one-position",
        id,
        action.wallet,
        String(position.positionId),
        "earn-table-timing",
        timing.data,
        deployment.descriptor.chainId,
        diamond,
      ],
      enabled: action.ready && timing.data !== undefined,
      staleTime: 30_000,
      retry: false,
      queryFn: () =>
        bounded(async () => {
          const client = action.publicClient!,
            account = action.wallet!;
          const [stake, selectedAssets, allocations] = await Promise.all([
            client.readContract({
              address: diamond,
              abi: staticsAbi,
              functionName: "stakePosition",
              args: [position.positionId],
              account,
            }),
            client.readContract({
              address: diamond,
              abi: staticsAbi,
              functionName: "positionRewardAssets",
              args: [position.positionId],
              account,
            }),
            client.readContract({
              address: diamond,
              abi: staticsGaugeIncentivesAbi,
              functionName: "gaugePositionAllocations",
              args: [position.positionId],
              account,
            }),
          ]);
          const selections = await Promise.all(
            selectedAssets.map(async (asset) => {
              if (timing.data) {
                const [selection, pendingStartTime] = await client.readContract({
                  address: diamond,
                  abi: staticsRewardSelectionTimingAbi,
                  functionName: "rewardSelectionWithTiming",
                  args: [position.positionId, asset],
                  account,
                });
                return { asset, selection, pendingStartTime: BigInt(pendingStartTime) };
              }
              const selection = await client.readContract({
                address: diamond,
                abi: staticsAbi,
                functionName: "rewardSelection",
                args: [position.positionId, asset],
                account,
              });
              return { asset, selection, pendingStartTime: undefined };
            })
          );
          return {
            stakedBalance: stake.stakedBalance,
            selectedAssets: selectedAssets as readonly Address[],
            selections: selections.map(({ asset, selection, pendingStartTime }) => ({
              asset: asset as Address,
              pendingStake: selection.pendingStake,
              eligibleAt: BigInt(selection.eligibleAt),
              pendingStartTime,
            })),
            allocation: {
              nextAllocationAt: BigInt(allocations[0]),
              totalAllocated: allocations[1],
              poolCount: allocations[2].length,
              active: allocations[2].map((entry) => ({
                poolId: entry.poolId,
                amount: entry.amount,
                eligibilityVersion: entry.eligibilityVersion,
              })),
              lockedStake: allocations[3],
            },
          };
        }),
    })),
  });
  const rows: EarnPositionRow[] = positions.map((position, index) => {
    const query = details[index],
      data = query?.data;
    const maturing =
      clock.data === undefined
        ? []
        : (data?.selections.filter((entry) => entry.pendingStake > 0n && entry.eligibleAt > now!) ??
          []);
    return {
      positionId: position.positionId,
      stakedBalance: data?.stakedBalance ?? position.stakedBalance,
      liquidityLegs: position.activeLegCount,
      selectedAssets: data?.selectedAssets,
      rewardSelections: data?.selections,
      maximumRewardAssets: limits.data,
      maturingAssets: data ? maturing.map((entry) => entry.asset) : undefined,
      maturesAt: maturing.length
        ? maturing.reduce(
            (min, entry) => (entry.eligibleAt < min ? entry.eligibleAt : min),
            maturing[0].eligibleAt
          )
        : undefined,
      assetMaturity: Object.fromEntries(
        maturing.map((entry) => [entry.asset.toLowerCase(), entry.eligibleAt])
      ),
      allocation: data?.allocation,
      unavailable: Boolean(
        (query?.isError && !data) ||
        (clock.isError && now === undefined) ||
        (timing.isError && timing.data === undefined)
      ),
    };
  });
  return {
    rows,
    now,
    loading: timing.isLoading || details.some((query) => query.isLoading),
    refetch: () => Promise.all(details.map((query) => query.refetch())),
  };
}

let active = 0;
const waiting: (() => void)[] = [];
async function bounded<T>(read: () => Promise<T>): Promise<T> {
  if (active >= 4) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  try {
    return await read();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
