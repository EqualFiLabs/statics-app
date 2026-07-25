import type { Connection, SignatureStatus } from "@solana/web3.js";
import { createPublicClient, http, type Chain, type TransactionReceipt } from "viem";

import { updateProtocolActivity, type ProtocolActivity } from "@/lib/dollar/activity";
import { getFundingNetwork } from "@/lib/funding-networks";
import { updateSolanaActivity, type SolanaActivity } from "@/lib/portal/solana-activity";
import { anvil, robinhoodMainnet, robinhoodTestnet } from "@/lib/wallet-config";

function protocolChain(chainId: number): Chain | null {
  return (
    getFundingNetwork(chainId)?.chain ??
    (chainId === robinhoodMainnet.id
      ? robinhoodMainnet
      : chainId === robinhoodTestnet.id
        ? robinhoodTestnet
        : chainId === anvil.id
          ? anvil
          : null)
  );
}

export async function recoverProtocolActivity(
  activity: ProtocolActivity,
  getReceipt?: (hash: `0x${string}`) => Promise<TransactionReceipt>
) {
  if (activity.status !== "submitted" || !activity.hash) return activity;
  try {
    const chain = protocolChain(activity.chainId);
    if (!chain && !getReceipt) return activity;
    const receipt = getReceipt
      ? await getReceipt(activity.hash)
      : await createPublicClient({
          chain: chain!,
          transport: http(chain!.rpcUrls.default.http[0]),
        }).getTransactionReceipt({ hash: activity.hash });
    const update =
      receipt.status === "success"
        ? {
            status: "confirmed-unverified" as const,
            confirmedHash: receipt.transactionHash,
            error: "Receipt confirmed after reload. Refresh protocol state before another action.",
          }
        : {
            status: "reverted" as const,
            confirmedHash: receipt.transactionHash,
            error: "The transaction reverted onchain.",
          };
    updateProtocolActivity(activity.wallet, activity.chainId, activity.id, update);
    return { ...activity, ...update };
  } catch {
    return activity;
  }
}

export async function recoverSolanaActivity(
  activity: SolanaActivity,
  connection: Pick<Connection, "getSignatureStatus">
) {
  if (activity.status !== "submitted" || !activity.signature) return activity;
  try {
    const result = await connection.getSignatureStatus(activity.signature, {
      searchTransactionHistory: true,
    });
    return applySolanaStatus(activity, result.value);
  } catch {
    return activity;
  }
}

function applySolanaStatus(activity: SolanaActivity, status: SignatureStatus | null) {
  if (!status) return activity;
  if (status.err) {
    const update = { status: "failed" as const, error: "The transaction failed on Solana." };
    updateSolanaActivity(activity.id, update);
    return { ...activity, ...update };
  }
  if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
    const update = { status: "confirmed" as const };
    updateSolanaActivity(activity.id, update);
    return { ...activity, ...update };
  }
  return activity;
}
