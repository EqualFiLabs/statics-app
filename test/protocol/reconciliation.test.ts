import type { Address, PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  announceProtocolTransactionConfirmed,
  retryConfirmationVerification,
  protocolQueryScopes,
  queryMatchesProtocolReconciliation,
  scheduleProtocolReconciliation,
  subscribeToProtocolReconciliation,
  subscribeToProtocolTransactions,
  waitForRpcBlock,
} from "@/lib/protocol/reconciliation";

describe("confirmed transaction reconciliation", () => {
  it("waits until the read RPC serves the confirmed block", async () => {
    const getBlockNumber = vi.fn().mockResolvedValueOnce(99n).mockResolvedValueOnce(100n);

    await expect(
      waitForRpcBlock({ getBlockNumber } as unknown as PublicClient, 100n, [0, 0])
    ).resolves.toBe(true);
    expect(getBlockNumber).toHaveBeenCalledTimes(2);
    expect(getBlockNumber).toHaveBeenCalledWith({ cacheTime: 0 });
  });

  it("retries a stale confirmation read before reporting failure", async () => {
    const verify = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("stale balance"))
      .mockResolvedValueOnce();

    await expect(retryConfirmationVerification(verify, [0, 0])).resolves.toBeUndefined();
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it("announces the wallet, chain, and block that need reconciliation", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToProtocolTransactions(listener);
    const detail = {
      wallet: "0x0000000000000000000000000000000000000001" as Address,
      chainId: 46_630,
      blockNumber: 123n,
      kind: "mint-basket" as const,
      scopes: protocolQueryScopes("mint-basket"),
    };

    announceProtocolTransactionConfirmed(detail);

    expect(listener).toHaveBeenCalledWith(detail);
    unsubscribe();
  });

  it("runs bounded refresh passes and supports cancellation", async () => {
    vi.useFakeTimers();
    try {
      const refresh = vi.fn();
      const cancel = scheduleProtocolReconciliation(refresh, [0, 10, 20]);

      await vi.advanceTimersByTimeAsync(10);
      expect(refresh).toHaveBeenCalledTimes(2);

      cancel();
      await vi.runAllTimersAsync();
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("replaces an older transaction schedule and cancels the latest on unsubscribe", async () => {
    vi.useFakeTimers();
    try {
      const refresh = vi.fn();
      const wallet = "0x0000000000000000000000000000000000000001" as Address;
      const unsubscribe = subscribeToProtocolReconciliation(refresh, () => true, [10, 20]);

      announceProtocolTransactionConfirmed({
        wallet,
        chainId: 46_630,
        blockNumber: 100n,
        kind: "repay-loan",
        scopes: protocolQueryScopes("repay-loan"),
      });
      await vi.advanceTimersByTimeAsync(10);
      expect(refresh).toHaveBeenCalledTimes(1);

      announceProtocolTransactionConfirmed({
        wallet,
        chainId: 46_630,
        blockNumber: 101n,
        kind: "repay-loan",
        scopes: protocolQueryScopes("repay-loan"),
      });
      await vi.advanceTimersByTimeAsync(10);
      expect(refresh).toHaveBeenCalledTimes(2);

      unsubscribe();
      await vi.runAllTimersAsync();
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("targets only affected query families for the confirmed wallet", () => {
    const wallet = "0x0000000000000000000000000000000000000001" as Address;
    const detail = {
      wallet,
      chainId: 46_630,
      blockNumber: 100n,
      kind: "repay-loan" as const,
      scopes: protocolQueryScopes("repay-loan"),
    };

    expect(queryMatchesProtocolReconciliation(["loan-catalog", "release", wallet], detail)).toBe(
      true
    );
    expect(
      queryMatchesProtocolReconciliation(["position-catalog", "release", wallet], detail)
    ).toBe(true);
    expect(queryMatchesProtocolReconciliation(["reward-preview", wallet], detail)).toBe(false);
    expect(
      queryMatchesProtocolReconciliation(
        ["canonical-swap-pool", "1", "0x0000000000000000000000000000000000000002"],
        { ...detail, kind: "swap", scopes: protocolQueryScopes("swap") }
      )
    ).toBe(true);
    expect(
      queryMatchesProtocolReconciliation(
        ["loan-catalog", "release", "0x0000000000000000000000000000000000000002"],
        detail
      )
    ).toBe(false);
  });
});
