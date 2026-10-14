import { encodeFunctionData, type Address } from "viem";
import {
  buildActivateGenesisCall,
  buildCheckpointRewardAssetsCall,
  buildLinkGenesisCall,
  buildUnlinkGenesisCall,
  staticsTokenAbi,
} from "@statics-protocol/sdk";

import type { DollarDeployment } from "@/lib/dollar/deployment";
import type { AtomicBatch, StaticsCall } from "@/lib/genesis/atomic-batch";
import { checkpointRewardAssetBatches } from "@/lib/positions/staking";

export type ProtocolBatchAction = "activate" | "link" | "unlink";
export type ProtocolBatchOperator = Readonly<{
  id: bigint;
  tier: number;
  linkedPositionId: bigint;
  targetTier?: number;
  positionId?: bigint;
}>;

export function buildProtocolGenesisBatch(args: {
  deployment: DollarDeployment;
  action: ProtocolBatchAction;
  operators: readonly ProtocolBatchOperator[];
  costs?: readonly bigint[];
  balance?: bigint;
  allowance?: bigint;
  rewardAssetsToCheckpoint?: readonly Address[];
}): Readonly<{ batch: AtomicBatch; tokenAmount: bigint; approvalAmount: bigint }> {
  const { deployment, action, operators } = args;
  if (operators.length < 1) throw new Error("Select an Operator.");
  if (new Set(operators.map((operator) => operator.id.toString())).size !== operators.length) {
    throw new Error("The same Operator was selected more than once.");
  }
  const genesis = deployment.genesis;
  if (!genesis) throw new Error("No Genesis deployment is configured.");
  const calls: StaticsCall[] = [];
  const labels: string[] = [];
  const add = (to: Address, data: `0x${string}`, label: string) => {
    calls.push({ to, data, value: 0n });
    labels.push(label);
  };
  const diamond = deployment.contracts.diamond;
  const checkpointAssets = [...new Set(args.rewardAssetsToCheckpoint ?? [])];
  for (const batch of checkpointRewardAssetBatches(checkpointAssets)) {
    add(
      diamond,
      buildCheckpointRewardAssetsCall(batch),
      `checkpoint ${batch.length} reward assets`
    );
  }

  let tokenAmount = 0n;
  let approvalAmount = 0n;
  if (action === "activate") {
    const costs = args.costs;
    if (!costs || costs.length !== 4) throw new Error("Fresh tier costs are required.");
    for (const operator of operators) {
      const target = operator.targetTier;
      if (!target || target <= operator.tier || target > 4) {
        throw new Error(`Choose a higher tier for Operator #${operator.id}.`);
      }
      tokenAmount += costs.slice(operator.tier, target).reduce((sum, cost) => sum + cost, 0n);
    }
    if (args.balance === undefined || args.balance < tokenAmount) {
      throw new Error("Insufficient STATICS for the selected activations.");
    }
    if ((args.allowance ?? 0n) < tokenAmount) {
      if ((args.allowance ?? 0n) > 0n) {
        add(
          genesis.token,
          encodeFunctionData({
            abi: staticsTokenAbi,
            functionName: "approve",
            args: [diamond, 0n],
          }),
          "reset existing STATICS approval"
        );
      }
      add(
        genesis.token,
        encodeFunctionData({
          abi: staticsTokenAbi,
          functionName: "approve",
          args: [diamond, tokenAmount],
        }),
        "approve exact STATICS amount"
      );
      approvalAmount = tokenAmount;
    }
    for (const operator of operators) {
      add(
        diamond,
        buildActivateGenesisCall(
          operator.id,
          operator.targetTier!,
          costs.slice(operator.tier, operator.targetTier).reduce((sum, cost) => sum + cost, 0n)
        ),
        `activate Operator #${operator.id}`
      );
    }
    if (approvalAmount > 0n) {
      add(
        genesis.token,
        encodeFunctionData({ abi: staticsTokenAbi, functionName: "approve", args: [diamond, 0n] }),
        "revoke temporary STATICS approval"
      );
    }
  } else if (action === "link") {
    const seenPositions = new Set<string>();
    for (const operator of operators) {
      if (operator.tier === 0 || operator.linkedPositionId !== 0n || !operator.positionId) {
        throw new Error(`Operator #${operator.id} cannot be linked to the selected Position.`);
      }
      const key = operator.positionId.toString();
      if (seenPositions.has(key)) throw new Error("Each Operator needs a different Position.");
      seenPositions.add(key);
      add(
        diamond,
        buildLinkGenesisCall(operator.id, operator.positionId),
        `link Operator #${operator.id}`
      );
    }
  } else {
    for (const operator of operators) {
      if (operator.linkedPositionId === 0n)
        throw new Error(`Operator #${operator.id} is not linked.`);
      add(diamond, buildUnlinkGenesisCall(operator.id), `unlink Operator #${operator.id}`);
    }
  }
  return { batch: { calls, labels }, tokenAmount, approvalAmount };
}
