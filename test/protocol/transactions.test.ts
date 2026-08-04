import type { Address, Hex, PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readProtocolActivity } from "@/lib/dollar/activity";
import {
  defaultProtocolPresentation,
  executeProtocolTransaction,
} from "@/lib/protocol/transactions";

const wallet = "0x0000000000000000000000000000000000000001" as Address;
const target = "0x0000000000000000000000000000000000000002" as Address;
const hash = `0x${"11".repeat(32)}` as Hex;

describe("protocol transaction execution", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("simulates before signing and reports success only after a confirmed receipt", async () => {
    const call = vi.fn().mockResolvedValue({ data: "0x01" });
    const getBlockNumber = vi.fn().mockResolvedValue(17n);
    const waitForTransactionReceipt = vi.fn().mockResolvedValue({
      status: "success",
      transactionHash: hash,
      blockNumber: 17n,
    });
    const sendTransaction = vi.fn().mockResolvedValue(hash);

    await expect(
      executeProtocolTransaction({
        publicClient: {
          call,
          getBlockNumber,
          waitForTransactionReceipt,
        } as unknown as PublicClient,
        wallet,
        chainId: 31_337,
        kind: "create-position",
        label: "Create PositionNFT",
        amount: "1 PositionNFT",
        to: target,
        data: "0x1234",
        sendTransaction,
        describeError: (error) => (error instanceof Error ? error.message : "Unknown error"),
      })
    ).resolves.toBe(hash);

    expect(call).toHaveBeenCalledBefore(sendTransaction);
    expect(sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet,
        chainId: 31_337,
        to: target,
        presentation: expect.objectContaining({
          action: "Create PositionNFT",
          buttonText: "Create PositionNFT",
        }),
      })
    );
    expect(waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ hash, confirmations: 1 })
    );
    expect(getBlockNumber).toHaveBeenCalledWith({ cacheTime: 0 });
    expect(readProtocolActivity(wallet, 31_337)[0]).toMatchObject({
      kind: "create-position",
      status: "confirmed",
      confirmedHash: hash,
    });
  });

  it("discloses maximum approvals and the encoded spender", async () => {
    const spender = "0000000000000000000000000000000000000003";
    const approvalData = `0x095ea7b3${"0".repeat(24)}${spender}${"f".repeat(64)}` as Hex;
    const sendTransaction = vi.fn().mockResolvedValue(hash);

    await executeProtocolTransaction({
      publicClient: {
        call: vi.fn().mockResolvedValue({ data: "0x01" }),
        waitForTransactionReceipt: vi.fn().mockResolvedValue({
          status: "success",
          transactionHash: hash,
        }),
      } as unknown as PublicClient,
      wallet,
      chainId: 31_337,
      kind: "approve-loan-asset",
      label: "Approve TPA1 for loan repayment",
      amount: "1 TPA1",
      to: target,
      data: approvalData,
      sendTransaction,
      describeError: (error) => (error instanceof Error ? error.message : "Unknown error"),
    });

    expect(sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        presentation: expect.objectContaining({
          buttonText: "Approve unlimited spending",
          description: expect.stringContaining(
            "Spender: 0x0000000000000000000000000000000000000003"
          ),
        }),
      })
    );
  });

  it("describes allowance resets as revocations instead of new approval authority", () => {
    const spender = "0000000000000000000000000000000000000003";
    const resetData = `0x095ea7b3${"0".repeat(24)}${spender}${"0".repeat(64)}` as Hex;

    expect(
      defaultProtocolPresentation({
        kind: "approve-swap",
        label: "Ajustar permiso de intercambio",
        amount: "10 TPA1",
        data: resetData,
      })
    ).toMatchObject({
      buttonText: "Reset token approval",
      description: expect.stringContaining("removes the existing token spending allowance"),
    });

    const boundedData = `0x095ea7b3${"0".repeat(24)}${spender}${"0".repeat(63)}1` as Hex;
    expect(
      defaultProtocolPresentation({
        kind: "approve-swap",
        label: "Reset swap approval",
        amount: "10 TPA1",
        data: boundedData,
      }).buttonText
    ).toBe("Approve reviewed amount");
  });

  it("does not request a signature when simulation validation fails", async () => {
    const sendTransaction = vi.fn();
    const failure = new Error("Invalid simulated output");

    await expect(
      executeProtocolTransaction({
        publicClient: {
          call: vi.fn().mockResolvedValue({ data: "0x01" }),
        } as unknown as PublicClient,
        wallet,
        chainId: 31_337,
        kind: "mint-basket-collateral",
        label: "Mint basket collateral",
        amount: "1 BASKET",
        to: target,
        data: "0x1234",
        sendTransaction,
        validateSimulation: () => {
          throw failure;
        },
        describeError: (error) => (error instanceof Error ? error.message : "Unknown error"),
      })
    ).rejects.toThrow("Invalid simulated output");

    expect(sendTransaction).not.toHaveBeenCalled();
    expect(readProtocolActivity(wallet, 31_337)[0]).toMatchObject({
      status: "failed",
      error: "Invalid simulated output",
    });
  });

  it("preserves a confirmed receipt when refreshed state cannot be verified", async () => {
    const verificationFailure = new Error("Loan state remained stale");

    vi.useFakeTimers();
    try {
      const execution = executeProtocolTransaction({
        publicClient: {
          call: vi.fn().mockResolvedValue({ data: "0x" }),
          waitForTransactionReceipt: vi.fn().mockResolvedValue({
            status: "success",
            transactionHash: hash,
          }),
        } as unknown as PublicClient,
        wallet,
        chainId: 31_337,
        kind: "repay-loan",
        label: "Repay loan #23",
        amount: "2 assets",
        to: target,
        data: "0x1234",
        sendTransaction: vi.fn().mockResolvedValue(hash),
        describeError: (error) => (error instanceof Error ? error.message : "Unknown error"),
        verifyConfirmation: async () => {
          throw verificationFailure;
        },
      });
      const rejection = expect(execution).rejects.toThrow(
        "confirmed, but refreshed protocol state could not be verified"
      );
      await vi.runAllTimersAsync();
      await rejection;
    } finally {
      vi.useRealTimers();
    }

    expect(readProtocolActivity(wallet, 31_337)[0]).toMatchObject({
      kind: "repay-loan",
      status: "confirmed-unverified",
      confirmedHash: hash,
      error: expect.stringContaining("Refresh before another action"),
    });
  });
});
