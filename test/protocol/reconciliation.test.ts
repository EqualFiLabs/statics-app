import type { Address, PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  announceProtocolTransactionConfirmed,
  retryConfirmationVerification,
  scheduleProtocolReconciliation,
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
});
