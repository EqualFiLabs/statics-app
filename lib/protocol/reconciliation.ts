"use client";

import type { Address, PublicClient } from "viem";
import type { ProtocolActivityKind } from "@/lib/dollar/activity";

const RPC_CATCH_UP_DELAYS_MS = [0, 250, 750, 1_500, 3_000] as const;
const QUERY_RECONCILIATION_DELAYS_MS = [0, 1_500, 4_000, 8_000] as const;

export const PROTOCOL_TRANSACTION_CONFIRMED_EVENT = "statics:protocol-transaction-confirmed";

export type ProtocolQueryScope =
  "basket" | "position" | "loan" | "liquidity" | "reward" | "dollar" | "wallet" | "approval";

export type ProtocolTransactionConfirmedDetail = Readonly<{
  wallet: Address;
  chainId: number;
  blockNumber: bigint;
  kind: ProtocolActivityKind;
  scopes: readonly ProtocolQueryScope[];
}>;

const scopeRoots: Readonly<Record<string, ProtocolQueryScope>> = {
  "basket-catalog": "basket",
  "basket-quote": "basket",
  "canonical-swap-pool": "basket",
  "canonical-swap-quote": "basket",
  "canonical-swap-permit2-approval": "approval",
  "position-catalog": "position",
  "loan-catalog": "loan",
  "loan-borrow-quote": "loan",
  "loan-extension-quote": "loan",
  "liquidity-catalog": "liquidity",
  "reward-preview": "reward",
  "basket-reward-preview": "reward",
  "staking-snapshots": "reward",
  "basket-rewards": "reward",
  "overview-basket-rewards": "reward",
  "dollar-snapshot": "dollar",
  "dollar-quote": "dollar",
  "dollar-supply": "dollar",
  "overview-portfolio": "wallet",
  "wallet-nfts": "wallet",
  "approval-tools": "approval",
};

const walletScopedRoots = new Set([
  "basket-catalog",
  "position-catalog",
  "loan-catalog",
  "liquidity-catalog",
  "staking-snapshots",
  "basket-rewards",
  "overview-basket-rewards",
  "dollar-snapshot",
  "dollar-supply",
  "overview-portfolio",
  "wallet-nfts",
  "approval-tools",
]);

export function protocolQueryScopes(kind: ProtocolActivityKind): readonly ProtocolQueryScope[] {
  if (kind === "approve-swap") return ["approval", "basket", "dollar", "wallet"];
  if (kind === "approve-basket-asset") return ["approval", "basket", "position", "wallet"];
  if (kind === "approve-basket-token") return ["approval", "position", "loan", "wallet"];
  if (kind === "approve-staking-token") return ["approval", "position", "reward", "wallet"];
  if (kind === "approve-lp-token" || kind === "approve-lp-nft" || kind === "approve-permit2") {
    return ["approval", "liquidity", "basket", "wallet"];
  }
  if (kind === "approve-loan-asset") return ["approval", "loan", "wallet"];
  if (kind.startsWith("approve-") || kind.startsWith("revoke-") || kind === "set-app-approval") {
    return ["approval", "dollar", "wallet"];
  }
  if (kind.includes("basket"))
    return ["basket", "position", "loan", "liquidity", "reward", "wallet"];
  if (kind.includes("position") || kind === "transfer-nft") {
    return ["position", "loan", "liquidity", "reward", "wallet"];
  }
  if (kind.includes("loan") || kind === "borrow-liquidity") {
    return ["loan", "position", "basket", "liquidity", "wallet"];
  }
  if (kind.includes("lp-")) return ["liquidity", "position", "basket", "wallet"];
  if (kind.includes("reward") || kind === "stake-position" || kind === "unstake-position") {
    return ["reward", "position", "wallet"];
  }
  if (kind.includes("risk") || kind.includes("weth") || kind.includes("eth")) {
    return ["dollar", "wallet", "approval"];
  }
  if (kind.includes("pegged") || kind === "claim-testnet-fixtures") return ["dollar", "wallet"];
  if (kind === "swap" || kind === "bridge" || kind === "send")
    return ["wallet", "dollar", "basket"];
  return ["wallet"];
}

export function queryMatchesProtocolReconciliation(
  queryKey: readonly unknown[],
  detail: ProtocolTransactionConfirmedDetail
): boolean {
  const root = typeof queryKey[0] === "string" ? queryKey[0] : "";
  const scope = scopeRoots[root];
  if (!scope || !detail.scopes.includes(scope)) return false;
  if (!walletScopedRoots.has(root)) return true;
  const addresses = queryKey.filter((part): part is string =>
    /^0x[0-9a-f]{40}$/i.test(String(part))
  );
  return (
    addresses.length === 0 ||
    addresses.some((address) => address.toLowerCase() === detail.wallet.toLowerCase())
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

/**
 * A receipt can arrive before the RPC node used for reads serves that block.
 * Wait briefly for `eth_blockNumber` to catch up before callers refresh state.
 * Returning false keeps a confirmed transaction confirmed; scheduled query
 * reconciliation below continues trying without pretending the write failed.
 */
export async function waitForRpcBlock(
  publicClient: PublicClient,
  blockNumber: bigint,
  delays: readonly number[] = RPC_CATCH_UP_DELAYS_MS
): Promise<boolean> {
  for (const wait of delays) {
    if (wait > 0) await delay(wait);
    try {
      const current = await publicClient.getBlockNumber({ cacheTime: 0 });
      if (current >= blockNumber) return true;
    } catch {
      // A later attempt may land on a healthy RPC backend.
    }
  }
  return false;
}

/**
 * Confirmation verification is read-only and safe to repeat. A single stale
 * read must not turn a successful transaction into a false verification error.
 */
export async function retryConfirmationVerification(
  verify: () => Promise<void>,
  delays: readonly number[] = RPC_CATCH_UP_DELAYS_MS
): Promise<void> {
  let lastError: unknown = new Error("Confirmed state could not be verified.");
  for (const wait of delays) {
    if (wait > 0) await delay(wait);
    try {
      await verify();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function announceProtocolTransactionConfirmed(
  detail: ProtocolTransactionConfirmedDetail
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ProtocolTransactionConfirmedDetail>(PROTOCOL_TRANSACTION_CONFIRMED_EVENT, {
      detail,
    })
  );
}

export function subscribeToProtocolTransactions(
  listener: (detail: ProtocolTransactionConfirmedDetail) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handle = (event: Event) => {
    listener((event as CustomEvent<ProtocolTransactionConfirmedDetail>).detail);
  };
  window.addEventListener(PROTOCOL_TRANSACTION_CONFIRMED_EVENT, handle);
  return () => window.removeEventListener(PROTOCOL_TRANSACTION_CONFIRMED_EVENT, handle);
}

/**
 * Refresh active state immediately, then retry at bounded intervals. This is
 * deliberately transaction-triggered instead of permanent polling so normal
 * browsing does not multiply RPC traffic.
 */
export function scheduleProtocolReconciliation(
  refresh: () => void | Promise<unknown>,
  delays: readonly number[] = QUERY_RECONCILIATION_DELAYS_MS
): () => void {
  const timers = delays.map((wait) =>
    globalThis.setTimeout(() => {
      try {
        void Promise.resolve(refresh()).catch(() => undefined);
      } catch {
        // A later scheduled refresh can still reconcile the confirmed write.
      }
    }, wait)
  );
  return () => timers.forEach((timer) => globalThis.clearTimeout(timer));
}

/**
 * Keep only the newest reconciliation schedule. Its reads include every state
 * transition through the newest confirmed block, so retaining older schedules
 * adds RPC work without preserving information.
 */
export function subscribeToProtocolReconciliation(
  refresh: (detail: ProtocolTransactionConfirmedDetail) => void | Promise<unknown>,
  matches: (detail: ProtocolTransactionConfirmedDetail) => boolean = () => true,
  delays: readonly number[] = QUERY_RECONCILIATION_DELAYS_MS
): () => void {
  let cancelReconciliation: (() => void) | null = null;
  const unsubscribe = subscribeToProtocolTransactions((detail) => {
    if (!matches(detail)) return;
    cancelReconciliation?.();
    cancelReconciliation = scheduleProtocolReconciliation(() => refresh(detail), delays);
  });
  return () => {
    unsubscribe();
    cancelReconciliation?.();
  };
}
