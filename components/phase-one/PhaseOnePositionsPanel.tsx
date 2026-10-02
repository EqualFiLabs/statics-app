"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { erc20Abi, formatUnits, getAddress, parseUnits, type Address } from "viem";
import { usePublicClient } from "wagmi";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { verifyPhaseOneDeploymentCached } from "@/lib/deployments/verify-phase-one";
import { loadIndexedPhaseOnePositions } from "@/lib/indexer/phase-one";
import {
  buildGaugeAllocationTransaction,
  buildGaugeRewardResolution,
  readPositionGaugeRewards,
  readPositionGaugeState,
  validateGaugeAllocationChange,
} from "@/lib/phase-one/gauges";
import {
  buildPositionStakingTransaction,
  buildStaticsStakeApproval,
  readPositionStakingState,
} from "@/lib/phase-one/staking";
import {
  executePhaseOneTransaction,
  verifyErc20Allowance,
  verifyGaugeAllocations,
} from "@/lib/phase-one/transactions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { useWalletState } from "@/providers/wallet-context";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "The Phase 1 position action failed.";
}

function addressList(value: string): readonly Address[] {
  if (!value.trim()) return [];
  return value.split(",").map((entry) => getAddress(entry.trim()));
}

export function PhaseOnePositionsPanel({ deployment }: { deployment: PhaseOneDeployment }) {
  const publicClient = usePublicClient();
  const walletState = useWalletState();
  const queryClient = useQueryClient();
  const wallet = walletState.address ? getAddress(walletState.address) : null;
  const [selectedId, setSelectedId] = useState("");
  const [stakeInput, setStakeInput] = useState("");
  const [rewardAssetInput, setRewardAssetInput] = useState("");
  const [allocationPoolId, setAllocationPoolId] = useState(
    deployment.supportedPools.find((pool) => pool.enabled)?.poolId ?? ""
  );
  const [allocationInput, setAllocationInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const positions = useQuery({
    queryKey: protocolQueryKeys.phaseOnePositions(deployment.descriptor.deploymentId, wallet),
    enabled: Boolean(wallet),
    retry: false,
    queryFn: async () => {
      if (!wallet || !publicClient) throw new Error("Connect a wallet to load PositionNFTs.");
      await verifyPhaseOneDeploymentCached(publicClient, deployment);
      return loadIndexedPhaseOnePositions(wallet, deployment.descriptor.deploymentId);
    },
  });
  const positionId = selectedId
    ? BigInt(selectedId)
    : (positions.data?.items[0]?.positionId ?? null);
  const live = useQuery({
    queryKey: protocolQueryKeys.phaseOnePosition(
      deployment.descriptor.deploymentId,
      wallet,
      positionId ?? 0n
    ),
    enabled: Boolean(publicClient && positionId !== null),
    queryFn: async () => {
      if (!publicClient || positionId === null) throw new Error("Select a PositionNFT.");
      const block = await publicClient.getBlock();
      const [staking, gauges] = await Promise.all([
        readPositionStakingState({ publicClient, deployment, positionId }),
        readPositionGaugeState({
          publicClient,
          deployment,
          positionId,
          now: Number(block.timestamp),
        }),
      ]);
      return { staking, gauges };
    },
  });
  const selectedPoolId = allocationPoolId as `0x${string}`;
  const gaugeRewards = useQuery({
    queryKey: protocolQueryKeys.phaseOneRewards(
      deployment.descriptor.deploymentId,
      wallet,
      positionId ?? 0n
    ),
    enabled: Boolean(publicClient && positionId !== null && allocationPoolId),
    queryFn: () => {
      if (!publicClient || positionId === null) throw new Error("Select a PositionNFT.");
      return readPositionGaugeRewards({
        publicClient,
        deployment,
        positionId,
        poolId: selectedPoolId,
        allocatorSlots: [0, 1, 2, 3, 4],
      });
    },
  });

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await action();
      await Promise.all([positions.refetch(), live.refetch()]);
      await queryClient.invalidateQueries({
        queryKey: ["phase-one-rewards", deployment.descriptor.deploymentId],
      });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setPending(false);
    }
  };

  const stake = () =>
    run(async () => {
      if (!publicClient || !wallet || positionId === null) throw new Error("Select a PositionNFT.");
      const amount = parseUnits(stakeInput, 18);
      const allowance = await publicClient.readContract({
        address: deployment.contracts.statics,
        abi: erc20Abi,
        functionName: "allowance",
        args: [wallet, deployment.contracts.diamond],
      });
      const approval = buildStaticsStakeApproval({ deployment, allowance, required: amount });
      if (approval.needed) {
        await executePhaseOneTransaction({
          deployment,
          publicClient,
          wallet,
          kind: "phase-one-approve-token",
          label: "Enable STATICS staking",
          amount: `${stakeInput} STATICS`,
          to: approval.target,
          data: approval.calldata,
          sendTransaction: walletState.sendEvmTransaction,
          describeError,
          verifyConfirmation: () =>
            verifyErc20Allowance({
              publicClient,
              token: deployment.contracts.statics,
              owner: wallet,
              spender: deployment.contracts.diamond,
              minimum: amount,
            }),
        });
      }
      const transaction = buildPositionStakingTransaction({
        deployment,
        positionId,
        action: { kind: "stake", amount },
      });
      await executePhaseOneTransaction({
        deployment,
        publicClient,
        wallet,
        kind: "phase-one-stake",
        label: `Stake STATICS in PositionNFT #${positionId}`,
        amount: `${stakeInput} STATICS`,
        to: transaction.target,
        data: transaction.calldata,
        sendTransaction: walletState.sendEvmTransaction,
        describeError,
      });
      setStakeInput("");
    });

  const unstake = () =>
    run(async () => {
      if (!publicClient || !wallet || positionId === null) throw new Error("Select a PositionNFT.");
      const amount = parseUnits(stakeInput, 18);
      const transaction = buildPositionStakingTransaction({
        deployment,
        positionId,
        action: { kind: "unstake", amount, receiver: wallet },
      });
      await executePhaseOneTransaction({
        deployment,
        publicClient,
        wallet,
        kind: "phase-one-unstake",
        label: `Unstake STATICS from PositionNFT #${positionId}`,
        amount: `${stakeInput} STATICS`,
        to: transaction.target,
        data: transaction.calldata,
        sendTransaction: walletState.sendEvmTransaction,
        describeError,
      });
      setStakeInput("");
    });

  const updateRewardAssets = (kind: "opt-in" | "opt-out") =>
    run(async () => {
      if (!publicClient || !wallet || positionId === null) throw new Error("Select a PositionNFT.");
      const assets = addressList(rewardAssetInput);
      const transaction = buildPositionStakingTransaction({
        deployment,
        positionId,
        action: { kind, assets },
      });
      await executePhaseOneTransaction({
        deployment,
        publicClient,
        wallet,
        kind: "phase-one-reward-selection",
        label: kind === "opt-in" ? "Add global reward assets" : "Remove global reward assets",
        amount: `${assets.length} assets`,
        to: transaction.target,
        data: transaction.calldata,
        sendTransaction: walletState.sendEvmTransaction,
        describeError,
      });
    });

  const claimGlobalRewards = () =>
    run(async () => {
      if (!publicClient || !wallet || positionId === null || !live.data)
        throw new Error("Position rewards are unavailable.");
      const assets = live.data.staking.selectedAssets;
      const transaction = buildPositionStakingTransaction({
        deployment,
        positionId,
        action: {
          kind: "claim",
          assets,
          minimumAmounts: assets.map(() => 0n),
          receiver: wallet,
        },
      });
      await executePhaseOneTransaction({
        deployment,
        publicClient,
        wallet,
        kind: "phase-one-claim-global-rewards",
        label: `Claim PositionNFT #${positionId} rewards`,
        amount: live.data.staking.pendingRewards.map(String).join(", "),
        to: transaction.target,
        data: transaction.calldata,
        sendTransaction: walletState.sendEvmTransaction,
        describeError,
      });
    });

  const setAllocation = () =>
    run(async () => {
      if (!publicClient || !wallet || positionId === null || !live.data)
        throw new Error("Gauge state is unavailable.");
      const next = allocationInput
        ? [{ poolId: allocationPoolId as `0x${string}`, amount: parseUnits(allocationInput, 18) }]
        : [];
      const block = await publicClient.getBlock();
      const validation = validateGaugeAllocationChange({
        current: live.data.gauges.allocations,
        next,
        stakedBalance: live.data.staking.stakedBalance,
        maximumAllocations: live.data.gauges.maximumAllocations,
        now: Number(block.timestamp),
      });
      const transaction = buildGaugeAllocationTransaction({
        deployment,
        positionId,
        next,
        validation,
      });
      await executePhaseOneTransaction({
        deployment,
        publicClient,
        wallet,
        kind: "phase-one-set-allocations",
        label: `Set PositionNFT #${positionId} gauge allocation`,
        amount: allocationInput ? `${allocationInput} STATICS` : "clear allocations",
        to: transaction.target,
        data: transaction.calldata,
        sendTransaction: walletState.sendEvmTransaction,
        describeError,
        verifyConfirmation: () =>
          verifyGaugeAllocations({ publicClient, deployment, positionId, expected: next }),
      });
    });

  const claimGaugeRewards = (kind: "claim-lp" | "claim-allocator") =>
    run(async () => {
      if (!publicClient || !wallet || positionId === null || !gaugeRewards.data)
        throw new Error("Gauge rewards are unavailable.");
      const claims =
        kind === "claim-lp"
          ? gaugeRewards.data.lp.amounts
              .slice(0, gaugeRewards.data.lp.slotCount)
              .map((amount, slot) => ({ slot, amount }))
              .filter((entry) => entry.amount > 0n)
          : gaugeRewards.data.allocator
              .filter((entry) => entry.amount > 0n)
              .map((entry) => ({ slot: entry.slot, amount: entry.amount }));
      if (claims.length === 0) throw new Error("No claimable gauge rewards are available.");
      const transaction = buildGaugeRewardResolution({
        deployment,
        positionId,
        poolId: selectedPoolId,
        action: {
          kind,
          slots: claims.map((entry) => entry.slot),
          minimumAmounts: claims.map(() => 0n),
          receiver: wallet,
        },
      });
      await executePhaseOneTransaction({
        deployment,
        publicClient,
        wallet,
        kind:
          kind === "claim-lp" ? "phase-one-claim-lp-rewards" : "phase-one-claim-allocator-rewards",
        label: kind === "claim-lp" ? "Claim LP gauge rewards" : "Claim allocator rewards",
        amount: claims.map((entry) => entry.amount.toString()).join(", "),
        to: transaction.target,
        data: transaction.calldata,
        sendTransaction: walletState.sendEvmTransaction,
        describeError,
      });
    });

  return (
    <section aria-label="Phase 1 PositionNFT staking and gauges">
      <h2>PositionNFT staking and gauges</h2>
      {!wallet && <p>Connect a wallet to load your Phase 1 positions.</p>}
      {positions.isError && <p role="alert">{describeError(positions.error)}</p>}
      {positions.data && positions.data.items.length === 0 && <p>No PositionNFTs found.</p>}
      {positions.data && positions.data.items.length > 0 && (
        <label>
          PositionNFT
          <select
            value={positionId?.toString() ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {positions.data.items.map((position) => (
              <option key={position.positionId.toString()} value={position.positionId.toString()}>
                #{position.positionId.toString()} | {formatUnits(position.stakedBalance, 18)}{" "}
                STATICS | {position.activeLegCount.toString()} active legs
              </option>
            ))}
          </select>
        </label>
      )}
      {live.data && (
        <dl>
          <div>
            <dt>Staked STATICS</dt>
            <dd>{formatUnits(live.data.staking.stakedBalance, 18)}</dd>
          </div>
          <div>
            <dt>Reward assets</dt>
            <dd>{live.data.staking.selectedAssets.length}</dd>
          </div>
          <div>
            <dt>Allocated STATICS</dt>
            <dd>{formatUnits(live.data.gauges.allocations.totalAllocated, 18)}</dd>
          </div>
          <div>
            <dt>Allocation mode</dt>
            <dd>{live.data.gauges.coolingDown ? "reductions only during cooldown" : "editable"}</dd>
          </div>
        </dl>
      )}
      <label>
        STATICS to stake
        <input value={stakeInput} onChange={(event) => setStakeInput(event.target.value)} />
      </label>
      <button
        type="button"
        disabled={pending || !wallet || !positionId || !stakeInput}
        onClick={stake}
      >
        Stake STATICS
      </button>
      <button
        type="button"
        disabled={pending || !wallet || !positionId || !stakeInput}
        onClick={unstake}
      >
        Unstake STATICS
      </button>
      <label>
        Reward asset addresses, comma separated
        <input
          value={rewardAssetInput}
          onChange={(event) => setRewardAssetInput(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={pending || !positionId || !rewardAssetInput}
        onClick={() => updateRewardAssets("opt-in")}
      >
        Add reward assets
      </button>
      <button
        type="button"
        disabled={pending || !positionId || !rewardAssetInput}
        onClick={() => updateRewardAssets("opt-out")}
      >
        Remove reward assets
      </button>
      <button
        type="button"
        disabled={pending || !live.data?.staking.selectedAssets.length}
        onClick={claimGlobalRewards}
      >
        Claim global rewards
      </button>
      <label>
        Gauge pool
        <select
          value={allocationPoolId}
          onChange={(event) => setAllocationPoolId(event.target.value)}
        >
          {deployment.supportedPools
            .filter((pool) => pool.enabled)
            .map((pool) => (
              <option key={pool.poolId} value={pool.poolId}>
                {pool.token0.symbol}/{pool.token1.symbol}
              </option>
            ))}
        </select>
      </label>
      <label>
        STATICS allocation, blank to clear
        <input
          value={allocationInput}
          onChange={(event) => setAllocationInput(event.target.value)}
        />
      </label>
      <button type="button" disabled={pending || !positionId || !live.data} onClick={setAllocation}>
        Set persistent gauge allocation
      </button>
      <button
        type="button"
        disabled={pending || !gaugeRewards.data?.lp.amounts.some((amount) => amount > 0n)}
        onClick={() => claimGaugeRewards("claim-lp")}
      >
        Claim LP gauge rewards
      </button>
      <button
        type="button"
        disabled={pending || !gaugeRewards.data?.allocator.some((entry) => entry.amount > 0n)}
        onClick={() => claimGaugeRewards("claim-allocator")}
      >
        Claim allocator rewards
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
