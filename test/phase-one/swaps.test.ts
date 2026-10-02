import { decodeFunctionData, erc20Abi, getAddress, maxUint160, maxUint256 } from "viem";
import { describe, expect, it } from "vitest";

import {
  permit2AllowanceAbi,
  universalRouterAbi,
  v4PoolId,
  type V4PoolKey,
} from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment, PublicPoolToken } from "@/lib/deployments/types";
import type { PublicPoolSelection } from "@/lib/phase-one/pools";
import {
  buildPublicExactInputSwap,
  feeFromGross,
  grossFromNet,
  minimumSwapOutput,
  planPublicSwapApprovals,
  swapDeadline,
  type PublicSwapQuote,
} from "@/lib/phase-one/swaps";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);

const poolKey: V4PoolKey = {
  currency0: address("1"),
  currency1: address("2"),
  fee: 3_000,
  tickSpacing: 60,
  hooks: address("3"),
};
const metadata = (tokenAddress: `0x${string}`, symbol: string): PublicPoolToken => ({
  address: tokenAddress,
  name: symbol,
  symbol,
  decimals: 18,
  metadataSource: "reviewed-manifest",
});
const pool: PublicPoolSelection = {
  poolId: v4PoolId(poolKey),
  poolKey,
  token0: metadata(poolKey.currency0, "ONE"),
  token1: metadata(poolKey.currency1, "TWO"),
  source: "reviewed-registry",
  directOnly: true,
  warning: null,
};
const deployment = {
  contracts: {
    universalRouter: address("4"),
    permit2: address("5"),
  },
} as PhaseOneDeployment;

describe("Phase 1 direct swaps", () => {
  it("matches the hook's ceiling fee semantics on both legs", () => {
    expect(feeFromGross(2_000n, 5)).toBe(1n);
    expect(feeFromGross(2_001n, 5)).toBe(2n);
    for (const gross of [2_000n, 2_001n, 999_999n]) {
      const net = gross - feeFromGross(gross, 5);
      expect(grossFromNet(net, 5) - feeFromGross(grossFromNet(net, 5), 5)).toBe(net);
    }
  });

  it("bounds slippage and deadlines", () => {
    expect(minimumSwapOutput(10_000n, 50)).toBe(9_950n);
    expect(() => minimumSwapOutput(10_000n, 5_001)).toThrow("slippage");
    expect(swapDeadline(1_000, 60)).toBe(1_060n);
    expect(() => swapDeadline(1_000, 3_601)).toThrow("deadline");
  });

  it("plans both layers of Permit2 approval and recognizes expired allowance", () => {
    const plan = planPublicSwapApprovals({
      token: poolKey.currency0,
      permit2: deployment.contracts.permit2,
      router: deployment.contracts.universalRouter,
      amount: 100n,
      tokenAllowance: 0n,
      permit2Allowance: 100n,
      permit2Expiration: 999,
      currentTimestamp: 1_000,
    });
    expect(plan.ready).toBe(false);
    expect(plan.needsTokenApproval).toBe(true);
    expect(plan.needsPermit2Approval).toBe(true);
    const tokenApproval = decodeFunctionData({
      abi: erc20Abi,
      data: plan.tokenApprovalCall!.calldata,
    });
    expect(tokenApproval.args).toEqual([deployment.contracts.permit2, maxUint256]);
    const permit2Approval = decodeFunctionData({
      abi: permit2AllowanceAbi,
      data: plan.permit2ApprovalCall!.calldata,
    });
    expect(permit2Approval.args?.[0]).toBe(poolKey.currency0);
    expect(permit2Approval.args?.[1]).toBe(deployment.contracts.universalRouter);
    expect(permit2Approval.args?.[2]).toBe(maxUint160);
  });

  it("builds one direct Universal Router execution with an exact deadline", () => {
    const quote: PublicSwapQuote = {
      poolId: pool.poolId,
      amountIn: 10_000n,
      amountOut: 20_000n,
      gasEstimate: 100_000n,
      zeroForOne: true,
      inputToken: poolKey.currency0,
      outputToken: poolKey.currency1,
      quotedAtBlock: 10n,
      fees: {
        nativeLpFeePips: 3_000,
        estimatedNativeLpFeeInput: 30n,
        staticsInputFeeBps: 5,
        staticsInputFee: 5n,
        staticsOutputFeeBps: 5,
        staticsOutputFee: 10n,
        estimatedGrossOutput: 20_010n,
      },
    };
    const built = buildPublicExactInputSwap({
      deployment,
      pool,
      quote,
      slippageBps: 50,
      deadline: 2_000n,
    });
    expect(built.target).toBe(deployment.contracts.universalRouter);
    expect(built.minimumAmountOut).toBe(19_900n);
    const execute = decodeFunctionData({ abi: universalRouterAbi, data: built.calldata });
    expect(execute.functionName).toBe("execute");
    expect(execute.args?.[0]).toBe("0x10");
    expect(execute.args?.[1]).toHaveLength(1);
    expect(execute.args?.[2]).toBe(2_000n);
  });
});
