import { beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeAcrossTransaction } from "@/lib/portal/across";
import { resolveAcrossConfig } from "@/lib/server/across";
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

  it("accepts credentials only from the server environment", () => {
    expect(
      resolveAcrossConfig({ ACROSS_API_KEY: "server-key", ACROSS_INTEGRATOR_ID: "0x1234" })
    ).toEqual({ apiKey: "server-key", integratorId: "0x1234" });
    expect(() => resolveAcrossConfig({})).toThrow("server environment");
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

  it("dispatches LayerZero activity to its status verifier", async () => {
    const activity = {
      id: "bridge-lz-1",
      provider: "layerzero" as const,
      wallet,
      recipient: wallet,
      originChainId: 8_453,
      destinationChainId: 4_663,
      inputSymbol: "EVE",
      outputSymbol: "EVE",
      amount: "0.000001",
      amountRaw: "1000000000000",
      depositTxnRef: hash,
      status: "submitted" as const,
      createdAt: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "filled",
            guid: `0x${"12".repeat(32)}`,
            destinationTxnRef: `0x${"34".repeat(32)}`,
          }),
          { status: 200 }
        )
      )
    );
    writeBridgeActivity(activity);
    await refreshBridgeActivity(activity);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("/api/layerzero/status?");
    expect(readBridgeActivity(wallet)[0]).toMatchObject({
      provider: "layerzero",
      status: "filled",
      guid: `0x${"12".repeat(32)}`,
      fillTxnRef: `0x${"34".repeat(32)}`,
    });
  });

  it("clears a prior delivery error after LayerZero verification recovers", async () => {
    const activity = {
      id: "bridge-lz-recovered",
      provider: "layerzero" as const,
      wallet,
      recipient: wallet,
      originChainId: 8_453,
      destinationChainId: 4_663,
      inputSymbol: "EVE",
      outputSymbol: "EVE",
      amount: "0.000001",
      amountRaw: "1000000000000",
      depositTxnRef: hash,
      status: "attention" as const,
      error: "Destination verification is temporarily unavailable.",
      createdAt: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "filled",
            destinationTxnRef: `0x${"34".repeat(32)}`,
          }),
          { status: 200 }
        )
      )
    );
    writeBridgeActivity(activity);

    await refreshBridgeActivity(activity);

    expect(readBridgeActivity(wallet)[0]).toMatchObject({ status: "filled" });
    expect(readBridgeActivity(wallet)[0]?.error).toBeUndefined();
  });
});
