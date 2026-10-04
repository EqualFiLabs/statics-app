"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatUnits, getAddress } from "viem";
import { usePublicClient } from "wagmi";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  planGaugeCatchup,
  planPoolCheckpoint,
  planPublicRewardMaintenance,
  readPublicRewardMaintenanceState,
  type PublicMaintenanceAction,
} from "@/lib/phase-one/maintenance";
import { listedPublicPool, readPublicPoolPreflight } from "@/lib/phase-one/pools";
import { executePhaseOneTransaction } from "@/lib/phase-one/transactions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { useWalletState } from "@/providers/wallet-context";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "The Phase 1 maintenance action failed.";
}

function activityKind(action: PublicMaintenanceAction) {
  if (action.kind === "gauge-schedule") return "phase-one-checkpoint-schedule" as const;
  if (action.kind === "gauge-pool") return "phase-one-checkpoint-pool" as const;
  if (action.kind === "pool-revenue") return "phase-one-settle-revenue" as const;
  return "phase-one-settle-rewards" as const;
}

export function PhaseOneMaintenancePanel({ deployment }: { deployment: PhaseOneDeployment }) {
  const publicClient = usePublicClient();
  const walletState = useWalletState();
  const queryClient = useQueryClient();
  const wallet = walletState.address ? getAddress(walletState.address) : null;
  const [poolIndex, setPoolIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pools = deployment.supportedPools.filter((candidate) => candidate.enabled);
  const selected = pools[poolIndex] ?? pools[0] ?? null;
  const pool = selected ? listedPublicPool(selected) : null;
  const preflight = useQuery({
    queryKey: protocolQueryKeys.phaseOneMaintenance(
      deployment.descriptor.deploymentId,
      pool?.poolId ?? "unselected"
    ),
    enabled: Boolean(publicClient && pool),
    queryFn: async () => {
      if (!publicClient || !pool) throw new Error("No public pool is selected.");
      const state = await readPublicPoolPreflight(publicClient, deployment, pool);
      const rewards = await Promise.all(
        [pool.token0.address, pool.token1.address].map((asset) =>
          readPublicRewardMaintenanceState({ publicClient, deployment, asset })
        )
      );
      return { state, rewards };
    },
  });

  const executeActions = async (actions: readonly PublicMaintenanceAction[]) => {
    if (!publicClient || !wallet || actions.length === 0) return;
    setPending(true);
    setError(null);
    try {
      for (const action of actions) {
        await executePhaseOneTransaction({
          deployment,
          publicClient,
          wallet,
          kind: activityKind(action),
          label: action.label,
          amount: "permissionless maintenance",
          to: action.target,
          data: action.calldata,
          sendTransaction: walletState.sendEvmTransaction,
          describeError,
        });
      }
      await preflight.refetch();
      await queryClient.invalidateQueries({
        queryKey: ["phase-one-maintenance", deployment.descriptor.deploymentId],
      });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setPending(false);
    }
  };

  if (!pool) return <p>No reviewed Phase 1 public pools are enabled for this deployment.</p>;
  const catchup = preflight.data
    ? planGaugeCatchup(deployment, preflight.data.state.gauge.freshness)
    : [];
  return (
    <section aria-label="Phase 1 permissionless maintenance">
      <h2>Permissionless maintenance</h2>
      <p>
        Anyone can submit bounded catch-up and settlement calls. Pool revenue settlement may pay the
        configured caller tip from the Treasury share. Other actions do not promise a tip.
      </p>
      <label>
        Pool
        <select value={poolIndex} onChange={(event) => setPoolIndex(Number(event.target.value))}>
          {pools.map((candidate, index) => (
            <option key={candidate.poolId} value={index}>
              {candidate.token0.symbol}/{candidate.token1.symbol}
            </option>
          ))}
        </select>
      </label>
      {preflight.data && (
        <dl>
          <div>
            <dt>Gauge schedule</dt>
            <dd>
              {preflight.data.state.gauge.freshness.stale
                ? `${preflight.data.state.gauge.freshness.periodsBehind} periods behind`
                : "current"}
            </dd>
          </div>
          {preflight.data.rewards.map((reward, index) => (
            <div key={reward.asset}>
              <dt>{index === 0 ? pool.token0.symbol : pool.token1.symbol} unfunded rewards</dt>
              <dd>
                {formatUnits(
                  reward.unfundedSwapRewards,
                  index === 0 ? pool.token0.decimals : pool.token1.decimals
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <button
        type="button"
        disabled={pending || !wallet || catchup.length === 0}
        onClick={() => executeActions(catchup)}
      >
        Catch up gauge schedule
      </button>
      <button
        type="button"
        disabled={
          pending || !wallet || !preflight.data || preflight.data.state.gauge.freshness.stale
        }
        onClick={() =>
          preflight.data &&
          executeActions([
            planPoolCheckpoint(deployment, pool.poolId, preflight.data.state.gauge.freshness),
          ])
        }
      >
        Checkpoint pool gauge
      </button>
      {preflight.data?.rewards.map((reward, index) => {
        const token = index === 0 ? pool.token0 : pool.token1;
        const actions = planPublicRewardMaintenance({
          deployment,
          poolId: pool.poolId,
          asset: reward.asset,
          unfundedSwapRewards: reward.unfundedSwapRewards,
          rewardBookNeedsCheckpoint: reward.rewardBookNeedsCheckpoint,
        });
        return (
          <button
            key={reward.asset}
            type="button"
            disabled={pending || !wallet}
            onClick={() => executeActions(actions)}
          >
            Settle and checkpoint {token.symbol}
          </button>
        );
      })}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
