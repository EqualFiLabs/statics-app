import { encodeFunctionData, type Address } from "viem";
import {
  buildActivateGenesisCall,
  buildRedeemGenesisCall,
  buildRegisterGenesisCall,
  cumulativeGenesisActivationCost,
  dopplerStaticsTokenAbi,
  staticsGenesisAbi,
} from "@statics-protocol/sdk";
import { buildRepayGenesisCreditCall } from "@statics-protocol/sdk/genesis-credit";
import {
  buildDrawGenesisCreditTransaction,
  buildExtendGenesisCreditTransaction,
  buildOpenGenesisCreditTransaction,
} from "@statics-protocol/sdk/genesis-credit";

import type { LaunchDeployment } from "@/lib/deployments/types";
import type { AtomicBatch, StaticsCall } from "@/lib/genesis/atomic-batch";
import type { OwnedGenesis } from "@/lib/genesis/owned";

export type LaunchBatchAction =
  "activate" | "register" | "open-credit" | "draw-credit" | "extend-credit" | "repay" | "redeem";
export type LaunchBatchPreview = Readonly<{
  action: LaunchBatchAction;
  operatorIds: readonly bigint[];
  tokenAmount: bigint;
  nativeAmount: bigint;
  approvalAmount: bigint;
  batch: AtomicBatch;
}>;

function call(to: Address, data: `0x${string}`): StaticsCall {
  return { to, data, value: 0n };
}

function approvalCall(token: Address, spender: Address, amount: bigint): StaticsCall {
  return call(
    token,
    encodeFunctionData({
      abi: dopplerStaticsTokenAbi,
      functionName: "approve",
      args: [spender, amount],
    })
  );
}

function appendExactApproval(
  calls: StaticsCall[],
  labels: string[],
  token: Address,
  spender: Address,
  needed: bigint,
  allowance: bigint
): bigint {
  if (needed <= allowance) return 0n;
  // Reset first for ERC-20s that reject a nonzero-to-nonzero approval change.
  if (allowance > 0n) {
    calls.push(approvalCall(token, spender, 0n));
    labels.push("reset existing STATICS approval");
  }
  calls.push(approvalCall(token, spender, needed));
  labels.push("approve exact STATICS amount");
  return needed;
}

function appendApprovalReset(
  calls: StaticsCall[],
  labels: string[],
  token: Address,
  spender: Address
) {
  calls.push(approvalCall(token, spender, 0n));
  labels.push("revoke temporary STATICS approval");
}

export function buildLaunchBatchPreview(args: {
  action: LaunchBatchAction;
  deployment: LaunchDeployment;
  selected: readonly OwnedGenesis[];
  wallet: Address;
  targetTier?: number;
  tierCosts?: readonly bigint[];
  staticsBalance?: bigint;
  currentAllowance?: bigint;
  nftApprovedForVault?: boolean;
  creditAmount?: bigint;
  nativeFees?: readonly bigint[];
}): LaunchBatchPreview {
  const { action, deployment, selected, wallet } = args;
  if (selected.length < 1) throw new Error("Select an Operator.");
  if (new Set(selected.map((item) => item.id.toString())).size !== selected.length) {
    throw new Error("The same Operator was selected more than once.");
  }
  const calls: StaticsCall[] = [];
  const labels: string[] = [];
  let tokenAmount = 0n;
  let nativeAmount = 0n;
  let approvalAmount = 0n;

  if (action === "activate") {
    const targetTier = args.targetTier;
    if (!targetTier || targetTier < 1 || targetTier > 4) throw new Error("Choose a valid tier.");
    const costs = args.tierCosts;
    if (!costs || costs.length < 5) throw new Error("Activation costs are unavailable.");
    for (const item of selected) {
      if (targetTier <= item.tier) throw new Error(`Operator #${item.id} is already at this tier.`);
      tokenAmount += cumulativeGenesisActivationCost(costs, item.tier, targetTier);
    }
    if (args.staticsBalance === undefined || args.staticsBalance < tokenAmount) {
      throw new Error("Insufficient STATICS for the selected activations.");
    }
    approvalAmount = appendExactApproval(
      calls,
      labels,
      deployment.contracts.statics,
      deployment.contracts.activationRegistry,
      tokenAmount,
      args.currentAllowance ?? 0n
    );
    for (const item of selected) {
      calls.push(
        call(deployment.contracts.activationRegistry, buildActivateGenesisCall(item.id, targetTier))
      );
      labels.push(`activate Operator #${item.id}`);
    }
    if (approvalAmount > 0n) {
      appendApprovalReset(
        calls,
        labels,
        deployment.contracts.statics,
        deployment.contracts.activationRegistry
      );
    }
  } else if (action === "register") {
    for (const item of selected) {
      if (item.registered) throw new Error(`Operator #${item.id} is already registered.`);
      calls.push(call(deployment.contracts.launchDistributor, buildRegisterGenesisCall(item.id)));
      labels.push(`register Operator #${item.id}`);
    }
  } else if (action === "open-credit" || action === "draw-credit" || action === "extend-credit") {
    if (!args.nativeFees || args.nativeFees.length !== selected.length) {
      throw new Error("Fresh native-fee quotes are required for each Operator.");
    }
    if (action !== "extend-credit" && (!args.creditAmount || args.creditAmount <= 0n)) {
      throw new Error("Enter a positive credit amount per Operator.");
    }
    for (const [index, item] of selected.entries()) {
      if (action === "open-credit" && item.creditActive) {
        throw new Error(`Operator #${item.id} already has active credit.`);
      }
      if (action !== "open-credit" && !item.creditActive) {
        throw new Error(`Operator #${item.id} has no active credit.`);
      }
      const fee = args.nativeFees[index];
      if (fee < 0n) throw new Error("A native-fee quote is invalid.");
      const transaction =
        action === "open-credit"
          ? buildOpenGenesisCreditTransaction(item.id, args.creditAmount!, fee)
          : action === "draw-credit"
            ? buildDrawGenesisCreditTransaction(item.id, args.creditAmount!, fee)
            : buildExtendGenesisCreditTransaction(item.id, fee);
      calls.push({
        to: deployment.contracts.vault,
        data: transaction.data,
        value: transaction.value,
      });
      labels.push(`${action.replace("-credit", "")} credit for Operator #${item.id}`);
      nativeAmount += transaction.value;
      if (action !== "extend-credit") tokenAmount += args.creditAmount!;
    }
  } else if (action === "repay") {
    for (const item of selected) {
      if (!item.creditActive || item.creditPrincipal <= 0n) {
        throw new Error(`Operator #${item.id} has no active credit to repay.`);
      }
      tokenAmount += item.creditPrincipal;
    }
    if (args.staticsBalance === undefined || args.staticsBalance < tokenAmount) {
      throw new Error("Insufficient STATICS to repay the selected credit.");
    }
    approvalAmount = appendExactApproval(
      calls,
      labels,
      deployment.contracts.statics,
      deployment.contracts.vault,
      tokenAmount,
      args.currentAllowance ?? 0n
    );
    for (const item of selected) {
      calls.push(
        call(deployment.contracts.vault, buildRepayGenesisCreditCall(item.id, item.creditPrincipal))
      );
      labels.push(`repay Operator #${item.id}`);
    }
    if (approvalAmount > 0n) {
      appendApprovalReset(calls, labels, deployment.contracts.statics, deployment.contracts.vault);
    }
  } else {
    for (const item of selected) {
      if (item.creditActive) throw new Error(`Repay Operator #${item.id} before redemption.`);
    }
    if (!args.nftApprovedForVault) {
      calls.push(
        call(
          deployment.contracts.genesis,
          encodeFunctionData({
            abi: staticsGenesisAbi,
            functionName: "setApprovalForAll",
            args: [deployment.contracts.vault, true],
          })
        )
      );
      labels.push("temporarily approve the Genesis vault");
    }
    for (const item of selected) {
      calls.push(call(deployment.contracts.vault, buildRedeemGenesisCall(item.id, wallet)));
      labels.push(`redeem Operator #${item.id}`);
    }
    if (!args.nftApprovedForVault) {
      calls.push(
        call(
          deployment.contracts.genesis,
          encodeFunctionData({
            abi: staticsGenesisAbi,
            functionName: "setApprovalForAll",
            args: [deployment.contracts.vault, false],
          })
        )
      );
      labels.push("revoke temporary Genesis approval");
    }
  }

  return {
    action,
    operatorIds: selected.map((item) => item.id),
    tokenAmount,
    nativeAmount,
    approvalAmount,
    batch: { calls, labels },
  };
}
