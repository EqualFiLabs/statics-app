import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionReceipt } from "viem";

import {
  readProtocolActivity,
  writeProtocolActivity,
  type ProtocolActivity,
} from "@/lib/dollar/activity";
import { recoverProtocolActivity } from "@/lib/portal/activity-recovery";

const wallet = "0x0000000000000000000000000000000000000001";
const hash = `0x${"11".repeat(32)}` as const;

function activity(): ProtocolActivity {
  return {
    id: "submitted",
    wallet,
    chainId: 31_337,
    kind: "send",
    label: "Send ETH",
    amount: "1 ETH",
    status: "submitted",
    hash,
    createdAt: Date.now(),
  };
}

describe("protocol activity recovery", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("marks a recovered successful receipt as requiring state refresh", async () => {
    const entry = activity();
    writeProtocolActivity(entry);
    const getReceipt = vi.fn().mockResolvedValue({
      status: "success",
      transactionHash: hash,
    } as TransactionReceipt);

    await recoverProtocolActivity(entry, getReceipt);

    expect(readProtocolActivity(wallet, 31_337)[0]).toMatchObject({
      status: "confirmed-unverified",
      confirmedHash: hash,
    });
  });

  it("marks a recovered reverted receipt as reverted", async () => {
    const entry = activity();
    writeProtocolActivity(entry);
    const getReceipt = vi.fn().mockResolvedValue({
      status: "reverted",
      transactionHash: hash,
    } as TransactionReceipt);

    await recoverProtocolActivity(entry, getReceipt);

    expect(readProtocolActivity(wallet, 31_337)[0]).toMatchObject({
      status: "reverted",
      confirmedHash: hash,
    });
  });
});
