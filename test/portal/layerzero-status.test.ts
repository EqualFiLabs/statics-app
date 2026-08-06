import { encodeEventTopics, encodeAbiParameters } from "viem";
import { describe, expect, it, vi } from "vitest";

import { eveOftAbi } from "@/lib/portal/eve-bridge";
import {
  eveBridgeRpcUrl,
  resolveEveLayerZeroStatus,
  verifyEveDelivery,
} from "@/lib/server/eve-bridge";

const guid = `0x${"12".repeat(32)}` as const;
const destinationTxnRef = `0x${"34".repeat(32)}` as const;
const recipient = "0x0000000000000000000000000000000000000001" as const;

function scanPayload(status = "DELIVERED") {
  return {
    data: [
      {
        pathway: {
          srcEid: 30_184,
          dstEid: 30_416,
          sender: { address: "0x160407eFa8556D4CDbf53b543EB36d860ac5a171" },
          receiver: { address: "0x12Fa0ec31BE30677Fa38274b3AFBc2A0fCE7648F" },
        },
        guid,
        status: { name: status, message: "message status" },
        destination: {
          status: status === "DELIVERED" ? "SUCCEEDED" : "WAITING",
          tx: { txHash: destinationTxnRef },
        },
      },
    ],
  };
}

describe("LayerZero EVE status", () => {
  it("accepts only the configured EVE pathway", () => {
    expect(
      resolveEveLayerZeroStatus(scanPayload(), {
        originChainId: 8_453,
        destinationChainId: 4_663,
      })
    ).toEqual({ status: "filled", guid, destinationTxnRef });
    expect(
      resolveEveLayerZeroStatus(scanPayload(), {
        originChainId: 4_663,
        destinationChainId: 8_453,
      })
    ).toBeNull();
    expect(
      resolveEveLayerZeroStatus(scanPayload("BLOCKED"), {
        originChainId: 8_453,
        destinationChainId: 4_663,
      })
    ).toMatchObject({ status: "attention" });
  });

  it("requires explicit server RPC configuration", () => {
    expect(eveBridgeRpcUrl(8_453, { EVE_BASE_RPC_URL: "https://base.example" })).toBe(
      "https://base.example/"
    );
    expect(eveBridgeRpcUrl(4_663, {})).toBeNull();
    expect(eveBridgeRpcUrl(1, { EVE_BASE_RPC_URL: "https://base.example" })).toBeNull();
  });

  it("verifies the exact destination OFT receipt", async () => {
    const topics = encodeEventTopics({
      abi: eveOftAbi,
      eventName: "OFTReceived",
      args: { guid, toAddress: recipient },
    });
    const data = encodeAbiParameters(
      [{ type: "uint32" }, { type: "uint256" }],
      [30_184, 1_000_000_000_000n]
    );
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            status: "0x1",
            logs: [
              {
                address: "0x12Fa0ec31BE30677Fa38274b3AFBc2A0fCE7648F",
                topics,
                data,
              },
            ],
          },
        })
      )
    );
    const verified = await verifyEveDelivery(
      {
        originChainId: 8_453,
        destinationChainId: 4_663,
        destinationTxnRef,
        guid,
        recipient,
        amountRaw: 1_000_000_000_000n,
        rpcUrl: "https://rpc.example",
      },
      fetcher
    );
    expect(verified).toBe(true);
  });
});
