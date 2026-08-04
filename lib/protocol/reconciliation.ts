"use client";

import type { Address, PublicClient } from "viem";

const RPC_CATCH_UP_DELAYS_MS = [0, 250, 750, 1_500, 3_000] as const;
const QUERY_RECONCILIATION_DELAYS_MS = [0, 1_500, 4_000, 8_000] as const;

export const PROTOCOL_TRANSACTION_CONFIRMED_EVENT = "statics:protocol-transaction-confirmed";

export type ProtocolTransactionConfirmedDetail = Readonly<{
  wallet: Address;
  chainId: number;
  blockNumber: bigint;
}>;

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
  refresh: () => void | Promise<unknown>,
  matches: (detail: ProtocolTransactionConfirmedDetail) => boolean = () => true,
  delays: readonly number[] = QUERY_RECONCILIATION_DELAYS_MS
): () => void {
  let cancelReconciliation: (() => void) | null = null;
  const unsubscribe = subscribeToProtocolTransactions((detail) => {
    if (!matches(detail)) return;
    cancelReconciliation?.();
    cancelReconciliation = scheduleProtocolReconciliation(refresh, delays);
  });
  return () => {
    unsubscribe();
    cancelReconciliation?.();
  };
}
