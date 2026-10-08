"use client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { staticsGaugeIncentivesAbi, staticsRangeGaugeAbi } from "@statics-protocol/sdk/phase-one";
import type { ContractFunctionReturnType, Hex } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type {
  GaugeLegState,
  GaugePoolState,
  GaugeReserveState,
} from "@/lib/rewards/liquidity-rewards";
import { boundedGaugeRead, liquidityLegQuery } from "@/lib/rewards/gauge-reads";
import type { usePhaseOneAction } from "./usePhaseOneAction";

type Action = ReturnType<typeof usePhaseOneAction>;

/**
 * Range status and emission inputs for the pools and legs a wallet holds. One query per pool
 * and per leg, so one failed read leaves the rest of the page usable.
 */
export function useLiquidityGauges(
  deployment: PhaseOneDeployment,
  action: Action,
  legs: readonly Readonly<{ positionId: bigint; poolId: Hex }>[]
) {
  const id = deployment.descriptor.deploymentId,
    diamond = deployment.contracts.diamond;
  const identity = [deployment.descriptor.chainId, diamond.toLowerCase()];
  const poolIds = [...new Map(legs.map((leg) => [leg.poolId.toLowerCase(), leg.poolId])).values()];
  const reserve = useQuery({
    queryKey: ["phase-one-gauges", id, action.wallet, "liquidity-reserve", ...identity],
    enabled: action.ready && poolIds.length > 0,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<GaugeReserveState> => {
      const state = await boundedGaugeRead(action.publicClient!, () =>
        action.publicClient!.readContract({
          address: diamond,
          abi: staticsGaugeIncentivesAbi,
          functionName: "gaugeReserve",
        })
      );
      return {
        activated: state.activated,
        periodBudget: state.periodBudget,
        periodFinish: BigInt(state.periodFinish),
        totalAllocatedWeight: state.totalAllocatedWeight,
      };
    },
  });
  const clock = useQuery({
    queryKey: ["phase-one-gauges", id, action.wallet, "liquidity-clock", ...identity],
    enabled: action.ready && poolIds.length > 0,
    staleTime: 30_000,
    retry: false,
    queryFn: async () =>
      (
        await boundedGaugeRead(action.publicClient!, () =>
          action.publicClient!.getBlock({ blockTag: "latest" })
        )
      ).timestamp,
  });
  const pools = useQueries({
    queries: poolIds.map((poolId) => ({
      queryKey: [
        "phase-one-gauges",
        id,
        action.wallet,
        "liquidity-pool",
        poolId.toLowerCase(),
        ...identity,
      ],
      enabled: action.ready,
      staleTime: 30_000,
      retry: false,
      queryFn: async (): Promise<GaugePoolState> => {
        const client = action.publicClient!;
        const [pool, weight] = await Promise.all([
          boundedGaugeRead(client, () =>
            client.readContract({
              address: diamond,
              abi: staticsRangeGaugeAbi,
              functionName: "gaugePool",
              args: [poolId],
            })
          ),
          boundedGaugeRead(client, () =>
            client.readContract({
              address: diamond,
              abi: staticsGaugeIncentivesAbi,
              functionName: "gaugePoolWeight",
              args: [poolId],
            })
          ),
        ]);
        return {
          poolId,
          stopped: pool.stopped,
          referenceTick: Number(pool.referenceTick),
          activeGaugeLiquidity: BigInt(pool.activeGaugeLiquidity),
          weight: weight.weight,
          stale: weight.stale,
        };
      },
    })),
  });
  const legQueries = useQueries({
    queries: legs.map((leg) => ({
      ...liquidityLegQuery({
        publicClient: action.publicClient!,
        deployment,
        account: action.wallet!,
        ...leg,
      }),
      enabled: action.ready,
      select: (
        state: ContractFunctionReturnType<typeof staticsRangeGaugeAbi, "view", "lpLeg">
      ): GaugeLegState => ({
        ...leg,
        tickLower: Number(state.tickLower),
        tickUpper: Number(state.tickUpper),
        liquidity: BigInt(state.liquidity),
      }),
    })),
  });
  const poolOf = (poolId: Hex) =>
    pools.find((query) => query.data?.poolId.toLowerCase() === poolId.toLowerCase())?.data;
  const legOf = (positionId: bigint, poolId: Hex) =>
    legQueries.find(
      (query) =>
        query.data?.positionId === positionId &&
        query.data.poolId.toLowerCase() === poolId.toLowerCase()
    )?.data;
  return {
    reserve: reserve.data,
    now: clock.data,
    poolOf,
    legOf,
    loading:
      reserve.isLoading ||
      clock.isLoading ||
      pools.some((query) => query.isLoading) ||
      legQueries.some((query) => query.isLoading),
    unavailable:
      reserve.isError ||
      clock.isError ||
      pools.some((query) => query.isError) ||
      legQueries.some((query) => query.isError),
  };
}
