import { decodeFunctionData, erc20Abi, getAddress, maxUint256 } from "viem";
import { describe, expect, it } from "vitest";

import { staticsAbi } from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  buildPositionStakingTransaction,
  buildStaticsStakeApproval,
} from "@/lib/phase-one/staking";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const deployment = {
  contracts: { diamond: address("1"), statics: address("2") },
} as PhaseOneDeployment;

describe("Phase 1 PositionNFT staking", () => {
  it("approves STATICS to the Diamond custody pull", () => {
    const approval = buildStaticsStakeApproval({ deployment, allowance: 0n, required: 100n });
    expect(approval.needed).toBe(true);
    expect(approval.target).toBe(deployment.contracts.statics);
    expect(decodeFunctionData({ abi: erc20Abi, data: approval.calldata }).args).toEqual([
      deployment.contracts.diamond,
      maxUint256,
    ]);
  });

  it("encodes stake, unstake, reward selection, and claims as separate PositionNFT actions", () => {
    const receiver = address("3");
    const actions = [
      { kind: "stake" as const, amount: 100n },
      { kind: "unstake" as const, amount: 50n, receiver },
      { kind: "opt-in" as const, assets: [address("4")] },
      { kind: "opt-out" as const, assets: [address("4")] },
      { kind: "claim" as const, assets: [address("4")], minimumAmounts: [1n], receiver },
    ];
    expect(
      actions.map(
        (action) =>
          decodeFunctionData({
            abi: staticsAbi,
            data: buildPositionStakingTransaction({ deployment, positionId: 7n, action }).calldata,
          }).functionName
      )
    ).toEqual(["stake", "unstake", "optInRewardAssets", "optOutRewardAssets", "claimRewards"]);
  });
});
