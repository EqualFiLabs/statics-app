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
  it("refreshes Phase 1 positions after close and reward catch-up", () => {
    expect(protocolQueryScopes("phase-one-close-position")).toContain("phase-one-position");
    expect(protocolQueryScopes("phase-one-checkpoint-schedule")).toContain("phase-one-reward");
    expect(protocolQueryScopes("phase-one-claim-lp-rewards")).toContain("phase-one-liquidity");
    expect(protocolQueryScopes("phase-one-forfeit-lp-reward")).toContain("phase-one-liquidity");
  });

  it("refreshes liquidity catalog, fee previews, and wallet balances only for the matching wallet and deployment", () => {
    const detail = {
      wallet: "0x0000000000000000000000000000000000000001" as Address,
      chainId: 4663,
      deploymentId: "local",
      blockNumber: 100n,
      kind: "phase-one-provide-liquidity" as const,
      scopes: protocolQueryScopes("phase-one-provide-liquidity"),
    };
    for (const root of [
      "phase-one-liquidity-catalog",
      "phase-one-liquidity-fees",
      "phase-one-liquidity-balances",
      "phase-one-liquidity-native-balance",
    ]) {
      expect(queryMatchesProtocolReconciliation([root, "local", detail.wallet], detail)).toBe(true);
      expect(queryMatchesProtocolReconciliation([root, "other", detail.wallet], detail)).toBe(
        false
      );
      expect(
        queryMatchesProtocolReconciliation(
          [root, "local", "0x0000000000000000000000000000000000000002"],
          detail
        )
      ).toBe(false);
    }
    expect(protocolQueryScopes("phase-one-wrap-native")).toEqual(["wallet"]);
  });

  it("refreshes Earn wallet balances on a scoped stake receipt", () => {
    const detail = {
      wallet: "0x0000000000000000000000000000000000000001" as Address,
      chainId: 4663,
      deploymentId: "local",
      blockNumber: 100n,
      kind: "phase-one-stake" as const,
      scopes: protocolQueryScopes("phase-one-stake"),
    };
    expect(
      queryMatchesProtocolReconciliation(["earn-wallet-balance", "local", detail.wallet], detail)
    ).toBe(true);
    expect(
      queryMatchesProtocolReconciliation(["earn-wallet-balance", "other", detail.wallet], detail)
    ).toBe(false);
    expect(
      queryMatchesProtocolReconciliation(
        ["earn-wallet-balance", "local", "0x0000000000000000000000000000000000000002"],
        detail
      )
    ).toBe(false);
  });

  it("refreshes the shared allocation directory for its deployment after an allocation change", () => {
    const detail = {
      wallet: "0x0000000000000000000000000000000000000001" as Address,
      chainId: 4663,
      deploymentId: "local",
      blockNumber: 100n,
      kind: "phase-one-set-allocations" as const,
      scopes: protocolQueryScopes("phase-one-set-allocations"),
    };
    // Not wallet-scoped: every wallet's view of pool weights changes.
    expect(
      queryMatchesProtocolReconciliation(
        ["phase-one-allocation-directory", "local", "page", {}],
        detail
      )
    ).toBe(true);
    expect(
      queryMatchesProtocolReconciliation(
        ["phase-one-allocation-directory", "other", "page", {}],
        detail
      )
    ).toBe(false);
    expect(
      queryMatchesProtocolReconciliation(["phase-one-allocation-directory", "local", "page", {}], {
        ...detail,
        kind: "phase-one-wrap-native",
        scopes: protocolQueryScopes("phase-one-wrap-native"),
      })
    ).toBe(false);
  });
  it("refreshes account statements after any account transaction in the deployment", () => {
    const detail = {
      wallet: `0x${"1".repeat(40)}` as Address,
      chainId: 31337,
      deploymentId: "local",
      blockNumber: 100n,
      kind: "phase-one-provide-liquidity" as const,
      scopes: protocolQueryScopes("phase-one-provide-liquidity"),
    };
    expect(
      queryMatchesProtocolReconciliation(
        ["phase-one-statement", "local", "7", "page", "all"],
        detail
      )
    ).toBe(true);
    expect(
      queryMatchesProtocolReconciliation(["phase-one-statement", "local", "7", "page", "all"], {
        ...detail,
        kind: "phase-one-settle-rewards",
        scopes: protocolQueryScopes("phase-one-settle-rewards"),
      })
    ).toBe(true);
    expect(
      queryMatchesProtocolReconciliation(
        ["phase-one-statement", "other", "7", "page", "all"],
        detail
      )
    ).toBe(false);
  });

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
      deploymentId: "release",
      blockNumber: 123n,
      kind: "mint-basket" as const,
      scopes: protocolQueryScopes("mint-basket"),
    };

    announceProtocolTransactionConfirmed(detail);

    expect(listener).toHaveBeenCalledWith(detail);
    unsubscribe();
  });

  it("uses one immediate refresh by default", async () => {
    vi.useFakeTimers();
    try {
      const refresh = vi.fn();
      scheduleProtocolReconciliation(refresh);
      await vi.runAllTimersAsync();
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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
        deploymentId: "release",
        blockNumber: 100n,
        kind: "repay-loan",
        scopes: protocolQueryScopes("repay-loan"),
      });
      await vi.advanceTimersByTimeAsync(10);
      expect(refresh).toHaveBeenCalledTimes(1);

      announceProtocolTransactionConfirmed({
        wallet,
        chainId: 46_630,
        deploymentId: "release",
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
      deploymentId: "release",
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

    const approvalDetail = {
      ...detail,
      kind: "approve-permit2" as const,
      scopes: protocolQueryScopes("approve-permit2"),
    };
    expect(
      queryMatchesProtocolReconciliation(
        [
          "canonical-swap-permit2-approval",
          wallet,
          "0x0000000000000000000000000000000000000003",
          "100",
        ],
        approvalDetail
      )
    ).toBe(true);
    expect(
      queryMatchesProtocolReconciliation(
        [
          "canonical-swap-permit2-approval",
          "0x0000000000000000000000000000000000000002",
          "0x0000000000000000000000000000000000000003",
          "100",
        ],
        approvalDetail
      )
    ).toBe(false);
  });

  it("refreshes Genesis inventory and balances only for the confirmed wallet", () => {
    const wallet = "0x0000000000000000000000000000000000000001" as Address;
    const detail = {
      wallet,
      chainId: 4_663,
      deploymentId: "robinhood-genesis",
      blockNumber: 100n,
      kind: "buy-genesis" as const,
      scopes: protocolQueryScopes("buy-genesis"),
    };

    expect(
      queryMatchesProtocolReconciliation(["genesis-vault-swap", "robinhood-genesis"], detail)
    ).toBe(true);
    expect(
      queryMatchesProtocolReconciliation(
        ["genesis-vault-wallet", "robinhood-genesis", wallet],
        detail
      )
    ).toBe(true);
    expect(
      queryMatchesProtocolReconciliation(
        [
          "launch-overview-balance",
          "robinhood-genesis",
          "0x0000000000000000000000000000000000000002",
        ],
        detail
      )
    ).toBe(false);
    expect(queryMatchesProtocolReconciliation(["loan-catalog", "release", wallet], detail)).toBe(
      false
    );
  });

  it("keeps Phase 1 reconciliation scoped to its deployment", () => {
    const wallet = "0x0000000000000000000000000000000000000001" as Address;
    const detail = {
      wallet,
      chainId: 4_663,
      deploymentId: "robinhood-phase-one",
      blockNumber: 100n,
      kind: "phase-one-provide-liquidity" as const,
      scopes: protocolQueryScopes("phase-one-provide-liquidity"),
    };

    expect(
      queryMatchesProtocolReconciliation(
        ["phase-one-liquidity", "robinhood-phase-one", wallet, "7", "0xpool"],
        detail
      )
    ).toBe(true);
    expect(
      queryMatchesProtocolReconciliation(
        ["phase-one-liquidity", "robinhood-testnet-phase-one", wallet, "7", "0xpool"],
        detail
      )
    ).toBe(false);
    expect(detail.scopes).toContain("phase-one-position");
    expect(detail.scopes).toContain("phase-one-reward");
  });
});
