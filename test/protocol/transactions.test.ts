import type { Address, Hex, PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readProtocolActivity } from "@/lib/dollar/activity";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";

const wallet = "0x0000000000000000000000000000000000000001" as Address;
const target = "0x0000000000000000000000000000000000000002" as Address;
const hash = `0x${"11".repeat(32)}` as Hex;

describe("protocol transaction execution", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("simulates before signing and reports success only after a confirmed receipt", async () => {
    const call = vi.fn().mockResolvedValue({ data: "0x01" });
    const waitForTransactionReceipt = vi.fn().mockResolvedValue({
      status: "success",
      transactionHash: hash,
    });
    const sendTransaction = vi.fn().mockResolvedValue(hash);

    await expect(
      executeProtocolTransaction({
        publicClient: {
          call,
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
    expect(waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ hash, confirmations: 1 })
    );
    expect(readProtocolActivity(wallet, 31_337)[0]).toMatchObject({
      kind: "create-position",
      status: "confirmed",
      confirmedHash: hash,
    });
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
});
