import { beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeAcrossTransaction } from "@/lib/portal/across";
import {
  readBridgeActivity,
  refreshBridgeActivity,
  writeBridgeActivity,
} from "@/lib/portal/bridge-activity";

const wallet = "0x0000000000000000000000000000000000000001";
const target = "0x0000000000000000000000000000000000000002";
const hash = `0x${"ab".repeat(32)}`;

describe("Across bridge behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("rejects transactions outside the reviewed wallet and origin chain", () => {
    expect(
      normalizeAcrossTransaction(
        { chainId: 8_453, from: wallet, to: target, data: "0x1234", value: "0" },
        { chainId: 8_453, wallet }
      )
    ).toMatchObject({ chainId: 8_453, to: target, value: 0n });
    expect(() =>
      normalizeAcrossTransaction(
        { chainId: 42_161, from: wallet, to: target, data: "0x", value: "0" },
        { chainId: 8_453, wallet }
      )
    ).toThrow(/different origin chain/);
  });

  it("persists a deposit and reconciles its Across lifecycle", async () => {
    const activity = {
      id: "bridge-1",
      wallet,
      originChainId: 8_453,
      destinationChainId: 4_663,
      inputSymbol: "USDC",
      outputSymbol: "USDG",
      amount: "1",
      depositTxnRef: hash,
      status: "submitted" as const,
      createdAt: 1,
    };
    writeBridgeActivity(activity);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "filled", fillTxHash: "0xdestination" }), {
          status: 200,
        })
      )
    );
    await refreshBridgeActivity(activity);
    expect(readBridgeActivity(wallet)[0]).toMatchObject({
      status: "filled",
      fillTxnRef: "0xdestination",
    });
  });
});
