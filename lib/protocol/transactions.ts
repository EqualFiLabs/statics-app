"use client";

import type { Address, Hex, PublicClient } from "viem";

import {
  updateProtocolActivity,
  writeProtocolActivity,
  type ProtocolActivityKind,
  type ProtocolActivityStatus,
  type ProtocolReplacementReason,
} from "@/lib/dollar/activity";
import { isOnchainRevert, isWalletRejection } from "@/lib/dollar/transactions";

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
  sendTransaction: (request: { to: Address; data: Hex; value?: bigint }) => Promise<Hex>;
  describeError: (error: unknown) => string;
  validateSimulation?: (result: Hex | undefined) => void;
}>;

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
    stage = "signing";
    updateProtocolActivity(request.wallet, request.chainId, id, { status: "signing" });

    const hash = await request.sendTransaction({
      to: request.to,
      data: request.data,
      value: request.value,
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
