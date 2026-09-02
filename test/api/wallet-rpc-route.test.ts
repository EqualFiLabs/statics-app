import { afterEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";

import { POST } from "@/app/api/wallet-rpc/[chainId]/route";

const upstream = "https://rpc.example/v2/private-wallet-key";
const account = privateKeyToAccount(`0x${"01".repeat(32)}`);

function request(payload: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/wallet-rpc/4663", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(payload),
  });
}

async function signedTransaction(chainId: number) {
  return account.signTransaction({
    chainId,
    gas: 21_000n,
    maxFeePerGas: 2n,
    maxPriorityFeePerGas: 1n,
    nonce: 0,
    to: "0x1111111111111111111111111111111111111111",
    type: "eip1559",
    value: 1n,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Robinhood embedded-wallet RPC proxy", () => {
  it("forwards bounded transaction-preparation reads", async () => {
    vi.stubEnv("STATICS_ROBINHOOD_MAINNET_WALLET_RPC_URL", upstream);
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, jsonrpc: "2.0", result: "0x1" }), {
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetch);

    const response = await POST(
      request({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_getTransactionCount",
        params: [account.address, "pending"],
      }),
      { params: Promise.resolve({ chainId: "4663" }) }
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      upstream,
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
  });

  it("forwards one valid signed transaction for the requested chain", async () => {
    vi.stubEnv("STATICS_ROBINHOOD_MAINNET_WALLET_RPC_URL", upstream);
    const raw = await signedTransaction(4_663);
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 2, jsonrpc: "2.0", result: `0x${"22".repeat(32)}` }), {
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetch);

    const response = await POST(
      request({ id: 2, jsonrpc: "2.0", method: "eth_sendRawTransaction", params: [raw] }),
      { params: Promise.resolve({ chainId: "4663" }) }
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects unsigned sends, write batches, malformed signatures, and wrong-chain transactions", async () => {
    vi.stubEnv("STATICS_ROBINHOOD_MAINNET_WALLET_RPC_URL", upstream);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const raw = await signedTransaction(4_663);
    const wrongChain = await signedTransaction(46_630);

    const cases = [
      { id: 1, jsonrpc: "2.0", method: "eth_sendTransaction", params: [{}] },
      [
        { id: 2, jsonrpc: "2.0", method: "eth_sendRawTransaction", params: [raw] },
        { id: 3, jsonrpc: "2.0", method: "eth_chainId", params: [] },
      ],
      { id: 4, jsonrpc: "2.0", method: "eth_sendRawTransaction", params: ["0x01"] },
      { id: 5, jsonrpc: "2.0", method: "eth_sendRawTransaction", params: [wrongChain] },
    ];

    for (const payload of cases) {
      const response = await POST(request(payload), {
        params: Promise.resolve({ chainId: "4663" }),
      });
      expect([400, 403]).toContain(response.status);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires the application origin and explicit wallet RPC configuration", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const noOrigin = await POST(request({ method: "eth_chainId", params: [] }, ""), {
      params: Promise.resolve({ chainId: "4663" }),
    });
    expect(noOrigin.status).toBe(403);

    const crossOrigin = await POST(
      request({ method: "eth_chainId", params: [] }, "https://attacker.example"),
      { params: Promise.resolve({ chainId: "4663" }) }
    );
    expect(crossOrigin.status).toBe(403);

    vi.stubEnv("STATICS_ROBINHOOD_MAINNET_RPC_URL", "https://rpc.example/read-only-key");
    const missingConfiguration = await POST(request({ method: "eth_chainId", params: [] }), {
      params: Promise.resolve({ chainId: "4663" }),
    });
    expect(missingConfiguration.status).toBe(503);
    expect(await missingConfiguration.json()).toEqual({
      error: "STATICS_ROBINHOOD_MAINNET_WALLET_RPC_URL is not configured on the server.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards Retry-After and never logs signed data or provider credentials", async () => {
    vi.stubEnv("STATICS_ROBINHOOD_MAINNET_WALLET_RPC_URL", upstream);
    const raw = await signedTransaction(4_663);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 429, message: "rate limited" } }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "2" },
        })
      )
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await POST(
      request({ id: 6, jsonrpc: "2.0", method: "eth_sendRawTransaction", params: [raw] }),
      { params: Promise.resolve({ chainId: "4663" }) }
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("2");
    expect(warn).toHaveBeenCalledWith("Robinhood wallet RPC upstream request failed", {
      batchSize: 1,
      chainId: 4_663,
      durationMs: expect.any(Number),
      methods: ["eth_sendRawTransaction"],
      retryAfter: true,
      status: 429,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(raw);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-wallet-key");
  });
});
