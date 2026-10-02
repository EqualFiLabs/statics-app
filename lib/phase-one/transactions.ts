"use client";

import {
  decodeEventLog,
  erc20Abi,
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";

import {
  staticsAbi,
  staticsGaugeIncentivesAbi,
  staticsRangeGaugeAbi,
} from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  executeProtocolTransaction,
  type ProtocolTransactionRequest,
} from "@/lib/protocol/transactions";

export type PhaseOneTransactionRequest = Omit<
  ProtocolTransactionRequest,
  "chainId" | "deploymentId"
> &
  Readonly<{ deployment: PhaseOneDeployment }>;

export function executePhaseOneTransaction(request: PhaseOneTransactionRequest): Promise<Hex> {
  const { deployment, ...transaction } = request;
  return executeProtocolTransaction({
    ...transaction,
    chainId: deployment.descriptor.chainId,
    deploymentId: deployment.descriptor.deploymentId,
  });
}

export async function verifyErc20Allowance(input: {
  publicClient: PublicClient;
  token: Address;
  owner: Address;
  spender: Address;
  minimum: bigint;
}): Promise<void> {
  const allowance = await input.publicClient.readContract({
    address: input.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [input.owner, input.spender],
  });
  if (allowance < input.minimum)
    throw new Error("Confirmed token allowance is below the required amount.");
}

export function verifyExactErc20SwapBalanceChanges(input: {
  inputBalanceBefore: bigint;
  inputBalanceAfter: bigint;
  outputBalanceBefore: bigint;
  outputBalanceAfter: bigint;
  exactAmountIn: bigint;
  minimumAmountOut: bigint;
}): void {
  const inputSpent = input.inputBalanceBefore - input.inputBalanceAfter;
  const outputReceived = input.outputBalanceAfter - input.outputBalanceBefore;
  if (inputSpent !== input.exactAmountIn) {
    throw new Error("Confirmed swap input balance change does not match the exact input amount.");
  }
  if (outputReceived < input.minimumAmountOut) {
    throw new Error("Confirmed swap output balance change is below the minimum output.");
  }
}

export function verifyPhaseOneIndexerBlock(
  receipt: TransactionReceipt,
  indexedAtBlock: bigint
): void {
  if (indexedAtBlock < receipt.blockNumber) {
    throw new Error("The Phase 1 indexer has not reconciled the confirmed transaction block yet.");
  }
}

export function verifyMarketSwapReceipt(input: {
  receipt: TransactionReceipt;
  deployment: PhaseOneDeployment;
  poolId: Hex;
}): void {
  const found = input.receipt.logs.some((log) => {
    if (getAddress(log.address) !== getAddress(input.deployment.contracts.diamond)) return false;
    try {
      const decoded = decodeEventLog({
        abi: staticsAbi,
        data: log.data,
        topics: log.topics,
        strict: true,
      });
      return (
        decoded.eventName === "MarketSwapRecorded" &&
        decoded.args.poolId.toLowerCase() === input.poolId.toLowerCase()
      );
    } catch {
      return false;
    }
  });
  if (!found)
    throw new Error("The confirmed transaction did not record the expected MarketTape swap.");
}

export async function verifyPositionOwner(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  positionId: bigint;
  owner: Address;
}): Promise<void> {
  const owner = await input.publicClient.readContract({
    address: input.deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "ownerOf",
    args: [input.positionId],
  });
  if (getAddress(owner) !== getAddress(input.owner))
    throw new Error("Confirmed PositionNFT owner does not match the wallet.");
}

export async function verifyManagedLiquidity(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  positionId: bigint;
  poolId: Hex;
  expectedLiquidity: bigint;
}): Promise<void> {
  const leg = await input.publicClient.readContract({
    address: input.deployment.contracts.diamond,
    abi: staticsRangeGaugeAbi,
    functionName: "lpLeg",
    args: [input.positionId, input.poolId],
  });
  if (leg.liquidity !== input.expectedLiquidity) {
    throw new Error("Confirmed managed liquidity does not match the expected position state.");
  }
}

export async function verifyGaugeAllocations(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  positionId: bigint;
  account: Address;
  expected: readonly Readonly<{ poolId: Hex; amount: bigint }>[];
}): Promise<void> {
  const result = await input.publicClient.readContract({
    address: input.deployment.contracts.diamond,
    abi: staticsGaugeIncentivesAbi,
    functionName: "gaugePositionAllocations",
    args: [input.positionId],
    account: input.account,
  });
  const actual = new Map(
    result[2].map((allocation) => [allocation.poolId.toLowerCase(), allocation.amount])
  );
  if (
    actual.size !== input.expected.length ||
    input.expected.some(
      (allocation) => actual.get(allocation.poolId.toLowerCase()) !== allocation.amount
    )
  ) {
    throw new Error(
      "Confirmed gauge allocations do not match the requested persistent allocation set."
    );
  }
}
