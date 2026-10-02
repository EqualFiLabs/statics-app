import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  parseAbiParameters,
  type TransactionReceipt,
} from "viem";
import { describe, expect, it } from "vitest";

import { staticsAbi } from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  verifyExactErc20SwapBalanceChanges,
  verifyMarketSwapReceipt,
  verifyPhaseOneIndexerBlock,
} from "@/lib/phase-one/transactions";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const deployment = {
  contracts: { diamond: address("1") },
} as PhaseOneDeployment;

function receipt(poolId: `0x${string}`): TransactionReceipt {
  const topics = encodeEventTopics({
    abi: staticsAbi,
    eventName: "MarketSwapRecorded",
    args: { poolId, sequence: 1n },
  });
  return {
    blockHash: hash("a"),
    blockNumber: 100n,
    contractAddress: null,
    cumulativeGasUsed: 1n,
    effectiveGasPrice: 1n,
    from: address("2"),
    gasUsed: 1n,
    logs: [
      {
        address: deployment.contracts.diamond,
        blockHash: hash("a"),
        blockNumber: 100n,
        data: encodeAbiParameters(
          parseAbiParameters(
            "int256 poolDelta,uint256 staticsFeesPacked,int24 finalTick,uint24 nativeLpFee,uint8 flags"
          ),
          [1n, 2n, 3, 3_000, 1]
        ),
        logIndex: 0,
        removed: false,
        topics: topics as [`0x${string}`, ...`0x${string}`[]],
        transactionHash: hash("b"),
        transactionIndex: 0,
      },
    ],
    logsBloom: `0x${"0".repeat(512)}`,
    status: "success",
    to: address("3"),
    transactionHash: hash("b"),
    transactionIndex: 0,
    type: "eip1559",
  };
}

describe("Phase 1 transaction verification", () => {
  it("requires the exact MarketTape pool event", () => {
    expect(() =>
      verifyMarketSwapReceipt({ receipt: receipt(hash("1")), deployment, poolId: hash("1") })
    ).not.toThrow();
    expect(() =>
      verifyMarketSwapReceipt({ receipt: receipt(hash("1")), deployment, poolId: hash("2") })
    ).toThrow("expected MarketTape swap");
  });

  it("verifies exact ERC-20 input and bounded output balance changes", () => {
    expect(() =>
      verifyExactErc20SwapBalanceChanges({
        inputBalanceBefore: 1_000n,
        inputBalanceAfter: 900n,
        outputBalanceBefore: 10n,
        outputBalanceAfter: 205n,
        exactAmountIn: 100n,
        minimumAmountOut: 190n,
      })
    ).not.toThrow();
    expect(() =>
      verifyExactErc20SwapBalanceChanges({
        inputBalanceBefore: 1_000n,
        inputBalanceAfter: 901n,
        outputBalanceBefore: 10n,
        outputBalanceAfter: 205n,
        exactAmountIn: 100n,
        minimumAmountOut: 190n,
      })
    ).toThrow("exact input amount");
  });

  it("keeps receipt success separate from indexer reconciliation", () => {
    expect(() => verifyPhaseOneIndexerBlock(receipt(hash("1")), 99n)).toThrow("has not reconciled");
    expect(() => verifyPhaseOneIndexerBlock(receipt(hash("1")), 100n)).not.toThrow();
  });
});
