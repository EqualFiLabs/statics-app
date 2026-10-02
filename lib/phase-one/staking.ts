import {
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import {
  buildClaimRewardsCall,
  buildCreateAndStakeCall,
  buildOptInRewardAssetsCall,
  buildOptOutRewardAssetsCall,
  buildStakeCall,
  buildUnstakeCall,
  staticsAbi,
} from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";

export type PositionStakingState = Readonly<{
  positionId: bigint;
  owner: Address;
  stakedBalance: bigint;
  rewardMultiplierBps: number;
  selectedAssets: readonly Address[];
  pendingRewards: readonly bigint[];
  maximumRewardAssets: bigint;
  rewardEligibilityDelay: bigint;
  locked: boolean;
}>;

export function buildStaticsStakeApproval(input: {
  deployment: PhaseOneDeployment;
  allowance: bigint;
  required: bigint;
}): Readonly<{ needed: boolean; target: Address; calldata: Hex }> {
  if (input.required <= 0n) throw new Error("Stake amount must be greater than zero.");
  return {
    needed: input.allowance < input.required,
    target: input.deployment.contracts.statics,
    calldata: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [input.deployment.contracts.diamond, maxUint256],
    }),
  };
}

export async function buildCreateAndStakeTransaction(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  amount: bigint;
  receiver: Address;
  rewardAssets: readonly Address[];
}): Promise<Readonly<{ target: Address; calldata: Hex; value: bigint }>> {
  if (input.amount <= 0n) throw new Error("Stake amount must be greater than zero.");
  const [creationFee, maximumRewardAssets] = await Promise.all([
    input.publicClient.readContract({
      address: input.deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "positionCreationFee",
    }),
    input.publicClient.readContract({
      address: input.deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "maxRewardAssetsPerPosition",
    }),
  ]);
  if (BigInt(input.rewardAssets.length) > maximumRewardAssets) {
    throw new Error("Selected reward assets exceed the live per-position limit.");
  }
  return {
    target: input.deployment.contracts.diamond,
    calldata: buildCreateAndStakeCall(input.amount, input.receiver, input.rewardAssets),
    value: creationFee,
  };
}

export function buildPositionStakingTransaction(input: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
  action:
    | Readonly<{ kind: "stake"; amount: bigint }>
    | Readonly<{ kind: "unstake"; amount: bigint; receiver: Address }>
    | Readonly<{ kind: "opt-in"; assets: readonly Address[] }>
    | Readonly<{ kind: "opt-out"; assets: readonly Address[] }>
    | Readonly<{
        kind: "claim";
        assets: readonly Address[];
        minimumAmounts: readonly bigint[];
        receiver: Address;
      }>;
}): Readonly<{ target: Address; calldata: Hex; value: 0n }> {
  let calldata: Hex;
  switch (input.action.kind) {
    case "stake":
      if (input.action.amount <= 0n) throw new Error("Stake amount must be greater than zero.");
      calldata = buildStakeCall(input.positionId, input.action.amount);
      break;
    case "unstake":
      if (input.action.amount <= 0n) throw new Error("Unstake amount must be greater than zero.");
      calldata = buildUnstakeCall(input.positionId, input.action.amount, input.action.receiver);
      break;
    case "opt-in":
      if (input.action.assets.length === 0) throw new Error("Select at least one reward asset.");
      calldata = buildOptInRewardAssetsCall(input.positionId, input.action.assets);
      break;
    case "opt-out":
      if (input.action.assets.length === 0) throw new Error("Select at least one reward asset.");
      calldata = buildOptOutRewardAssetsCall(input.positionId, input.action.assets);
      break;
    case "claim":
      if (input.action.assets.length !== input.action.minimumAmounts.length) {
        throw new Error("Reward assets and minimum amounts must have equal length.");
      }
      calldata = buildClaimRewardsCall(
        input.positionId,
        input.action.assets,
        input.action.receiver,
        input.action.minimumAmounts
      );
      break;
  }
  return { target: input.deployment.contracts.diamond, calldata, value: 0n };
}

export async function readPositionStakingState(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  positionId: bigint;
  account: Address;
}): Promise<PositionStakingState> {
  const [owner, position, selectedAssets, maximumRewardAssets, rewardEligibilityDelay, locked] =
    await Promise.all([
      input.publicClient.readContract({
        address: input.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "ownerOf",
        args: [input.positionId],
        account: input.account,
      }),
      input.publicClient.readContract({
        address: input.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "stakePosition",
        args: [input.positionId],
        account: input.account,
      }),
      input.publicClient.readContract({
        address: input.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "positionRewardAssets",
        args: [input.positionId],
        account: input.account,
      }),
      input.publicClient.readContract({
        address: input.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "maxRewardAssetsPerPosition",
        account: input.account,
      }),
      input.publicClient.readContract({
        address: input.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "rewardEligibilityDelay",
        account: input.account,
      }),
      input.publicClient.readContract({
        address: input.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "locked",
        args: [input.positionId],
        account: input.account,
      }),
    ]);
  const pendingRewards =
    selectedAssets.length === 0
      ? []
      : await input.publicClient.readContract({
          address: input.deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "pendingRewards",
          args: [input.positionId, selectedAssets],
          account: input.account,
        });
  return {
    positionId: input.positionId,
    owner,
    stakedBalance: position.stakedBalance,
    rewardMultiplierBps: position.rewardMultiplierBps,
    selectedAssets,
    pendingRewards,
    maximumRewardAssets,
    rewardEligibilityDelay,
    locked,
  };
}
