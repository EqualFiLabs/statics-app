"use client";

import {
  getAddress,
  toFunctionSelector,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";

import {
  updateProtocolActivity,
  writeProtocolActivity,
  type ProtocolActivityKind,
  type ProtocolActivityStatus,
  type ProtocolReplacementReason,
} from "@/lib/dollar/activity";
import { isOnchainRevert, isWalletRejection } from "@/lib/dollar/transactions";
import {
  announceProtocolTransactionConfirmed,
  retryConfirmationVerification,
  protocolQueryScopes,
  waitForRpcBlock,
} from "@/lib/protocol/reconciliation";

export type ProtocolPermissionDisclosure = Readonly<{
  scope: "unlimited-token" | "maximum-permit2" | "erc721-operator" | "erc1155-operator";
  asset: string;
  spender: Address;
  spenderName: string;
  detail: string;
}>;

export type ProtocolTransactionPresentation = Readonly<{
  action: string;
  description: string;
  buttonText: string;
  contractName: string;
  permission?: ProtocolPermissionDisclosure;
}>;

export type ProtocolTransactionSendRequest = Readonly<{
  wallet: Address;
  chainId: number;
  to: Address;
  data: Hex;
  value?: bigint;
  gasLimit: bigint;
  presentation: ProtocolTransactionPresentation;
}>;

export type ProtocolTransactionRequest = Readonly<{
  publicClient: PublicClient;
  wallet: Address;
  chainId: number;
  kind: ProtocolActivityKind;
  label: string;
  amount: string;
  to: Address;
  data: Hex;
  value?: bigint;
  presentation?: ProtocolTransactionPresentation;
  sendTransaction: (request: ProtocolTransactionSendRequest) => Promise<Hex>;
  describeError: (error: unknown) => string;
  validateSimulation?: (result: Hex | undefined) => void;
  verifyConfirmation?: (receipt: TransactionReceipt) => Promise<void>;
}>;

export class ConfirmationVerificationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConfirmationVerificationError";
  }
}

const maximumTokenApprovalKinds = new Set<ProtocolActivityKind>([
  "approve-weth",
  "approve-dollar",
  "approve-basket-asset",
  "approve-basket-token",
  "approve-staking-token",
  "approve-lp-token",
  "approve-loan-asset",
]);

const operatorApprovalKinds = new Set<ProtocolActivityKind>(["approve-risk", "approve-lp-nft"]);
const erc20ApproveSelector = toFunctionSelector("approve(address,uint256)");
const permit2ApproveSelector = toFunctionSelector("approve(address,address,uint160,uint48)");
const operatorApproveSelector = toFunctionSelector("setApprovalForAll(address,bool)");

/**
 * Wallet RPCs do not all apply the same safety margin to `eth_estimateGas`.
 * Supplying one reviewed estimate with a modest buffer avoids a second,
 * wallet-specific estimate producing an invalid transaction request.
 */
export function bufferedGasLimit(estimate: bigint): bigint {
  return estimate + (estimate + 4n) / 5n;
}

function calldataAddress(data: Hex, wordIndex: number): Address | null {
  const wordStart = 10 + wordIndex * 64;
  const encoded = data.slice(wordStart + 24, wordStart + 64);
  if (encoded.length !== 40) return null;
  try {
    return getAddress(`0x${encoded}`);
  } catch {
    return null;
  }
}

function calldataUint(data: Hex, wordIndex: number): bigint | null {
  const wordStart = 10 + wordIndex * 64;
  const encoded = data.slice(wordStart, wordStart + 64);
  if (encoded.length !== 64) return null;
  try {
    return BigInt(`0x${encoded}`);
  } catch {
    return null;
  }
}

export function defaultProtocolPresentation(
  request: Pick<ProtocolTransactionRequest, "kind" | "label" | "amount" | "data">
): ProtocolTransactionPresentation {
  const isMaximumTokenApproval = maximumTokenApprovalKinds.has(request.kind);
  const isOperatorApproval = operatorApprovalKinds.has(request.kind);
  const isPermit2Approval = request.kind === "approve-permit2";
  const isBoundedApproval = request.kind === "approve-swap" || request.kind === "approve-bridge";
  const isErc20Approval = request.data.startsWith(erc20ApproveSelector);
  const erc20Allowance = isErc20Approval ? calldataUint(request.data, 1) : null;
  const spender = isPermit2Approval
    ? request.data.startsWith(permit2ApproveSelector)
      ? calldataAddress(request.data, 1)
      : null
    : isOperatorApproval
      ? request.data.startsWith(operatorApproveSelector)
        ? calldataAddress(request.data, 0)
        : null
      : isErc20Approval
        ? calldataAddress(request.data, 0)
        : null;
  const spenderCopy = spender ? ` Spender: ${spender}.` : "";

  if (isMaximumTokenApproval) {
    return {
      action: request.label,
      description: `${request.label}. This grants unlimited token spending until you revoke it.${spenderCopy} You can review or revoke it from Approval Tools.`,
      buttonText: "Approve unlimited spending",
      contractName: "Token approval",
    };
  }
  if (isPermit2Approval) {
    return {
      action: request.label,
      description: `${request.label}. This grants the maximum Permit2 allowance with no practical expiry; it remains active until revoked.${spenderCopy} You can review or revoke it from Approval Tools.`,
      buttonText: "Approve maximum allowance",
      contractName: "Permit2",
    };
  }
  if (isOperatorApproval) {
    const asset = request.kind === "approve-lp-nft" ? "liquidity-position NFTs" : "Risk share IDs";
    return {
      action: request.label,
      description: `${request.label}. This grants operator access to all current and future ${asset} until revoked.${spenderCopy} You can review or revoke it from Approval Tools.`,
      buttonText: "Approve operator access",
      contractName: request.kind === "approve-lp-nft" ? "Position Manager" : "Risk shares",
    };
  }
  if (isBoundedApproval && erc20Allowance === 0n) {
    return {
      action: request.label,
      description: `${request.label}. This removes the existing token spending allowance.${spenderCopy}`,
      buttonText: "Reset token approval",
      contractName: "Token approval",
    };
  }
  if (isBoundedApproval) {
    return {
      action: request.label,
      description: `${request.label}. This approval is bounded to the reviewed route amount: ${request.amount}.${spenderCopy}`,
      buttonText: "Approve reviewed amount",
      contractName: "Token approval",
    };
  }

  const contractName =
    request.kind === "swap"
      ? "Swap router"
      : request.kind === "bridge"
        ? "Across bridge"
        : request.kind === "send"
          ? "Wallet transfer"
          : "Statics protocol";
  return {
    action: request.label,
    description: `${request.label}. Reviewed amount: ${request.amount}.`,
    buttonText: request.label,
    contractName,
  };
}

export async function executeProtocolTransaction(
  request: ProtocolTransactionRequest
): Promise<Hex> {
  const id = crypto.randomUUID();
  let stage: "simulating" | "signing" | "submitted" | "finished" = "simulating";
  let replacementReason: ProtocolReplacementReason | undefined;

  writeProtocolActivity({
    id,
    wallet: request.wallet,
    chainId: request.chainId,
    kind: request.kind,
    label: request.label,
    amount: request.amount,
    status: "simulating",
    createdAt: Date.now(),
  });

  try {
    const simulation = await request.publicClient.call({
      account: request.wallet,
      to: request.to,
      data: request.data,
      value: request.value,
    });
    request.validateSimulation?.(simulation.data);
    const gasLimit = bufferedGasLimit(
      await request.publicClient.estimateGas({
        account: request.wallet,
        to: request.to,
        data: request.data,
        value: request.value,
      })
    );
    stage = "signing";
    updateProtocolActivity(request.wallet, request.chainId, id, { status: "signing" });

    const hash = await request.sendTransaction({
      wallet: request.wallet,
      chainId: request.chainId,
      to: request.to,
      data: request.data,
      value: request.value,
      gasLimit,
      presentation: request.presentation ?? defaultProtocolPresentation(request),
    });
    stage = "submitted";
    updateProtocolActivity(request.wallet, request.chainId, id, {
      hash,
      status: "submitted",
    });

    const receipt = await request.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      onReplaced: (replacement) => {
        replacementReason = replacement.reason;
        updateProtocolActivity(request.wallet, request.chainId, id, {
          status: "replaced",
          replacementHash: replacement.transaction.hash,
          replacementReason,
        });
      },
    });
    if (receipt.status !== "success") throw new Error("The transaction reverted onchain.");
    if (replacementReason === "cancelled" || replacementReason === "replaced") {
      const message =
        replacementReason === "cancelled"
          ? "The submitted transaction was cancelled in the wallet."
          : "The submitted transaction was replaced by a different wallet transaction.";
      stage = "finished";
      updateProtocolActivity(request.wallet, request.chainId, id, {
        status: "replaced",
        confirmedHash: receipt.transactionHash,
        error: message,
      });
      throw new Error(message);
    }

    if (typeof receipt.blockNumber === "bigint") {
      await waitForRpcBlock(request.publicClient, receipt.blockNumber);
      announceProtocolTransactionConfirmed({
        wallet: request.wallet,
        chainId: request.chainId,
        blockNumber: receipt.blockNumber,
        kind: request.kind,
        scopes: protocolQueryScopes(request.kind),
      });
    }

    if (request.verifyConfirmation) {
      try {
        await retryConfirmationVerification(() => request.verifyConfirmation!(receipt));
      } catch (error) {
        const verificationError = new ConfirmationVerificationError(
          "The transaction confirmed, but refreshed protocol state could not be verified. Refresh before another action.",
          { cause: error }
        );
        stage = "finished";
        updateProtocolActivity(request.wallet, request.chainId, id, {
          status: "confirmed-unverified",
          confirmedHash: receipt.transactionHash,
          error: verificationError.message,
        });
        throw verificationError;
      }
    }

    stage = "finished";
    updateProtocolActivity(request.wallet, request.chainId, id, {
      status: "confirmed",
      confirmedHash: receipt.transactionHash,
    });
    return receipt.transactionHash;
  } catch (error) {
    if (stage === "finished") throw error;
    let status: ProtocolActivityStatus = "failed";
    if (isWalletRejection(error)) status = "rejected";
    else if (stage === "submitted" && isOnchainRevert(error)) status = "reverted";
    updateProtocolActivity(request.wallet, request.chainId, id, {
      status,
      error: request.describeError(error),
    });
    throw error;
  }
}
