import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/across", () => ({ callAcross: vi.fn() }));
vi.mock("@/lib/portal/across", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/portal/across")>();
  return {
    ...original,
    readAcrossDestination: () => ({
      status: "configured" as const,
      chainId: 4_663,
      chainName: "Robinhood Chain",
      token: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
      symbol: "USDG",
      decimals: 6,
    }),
  };
});

const { callAcross } = await import("@/lib/server/across");
const { GET: chains } = await import("@/app/api/across/chains/route");
const { GET: tokens } = await import("@/app/api/across/tokens/route");
const { POST: quote } = await import("@/app/api/across/quote/route");
const { GET: status } = await import("@/app/api/across/status/route");
const across = vi.mocked(callAcross);
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const wallet = "0x0000000000000000000000000000000000000001";

const usdg = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const arbitrumUsdc = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

// Keyed by chain, because the quote route now resolves the destination token
// against the destination chain rather than trusting the caller.
const tokensByChain: Record<string, unknown[]> = {
  "8453": [{ chainId: 8_453, address: usdc, symbol: "USDC", name: "USD Coin", decimals: 6 }],
  "4663": [{ chainId: 4_663, address: usdg, symbol: "USDG", name: "Global Dollar", decimals: 6 }],
  "42161": [
    { chainId: 42_161, address: arbitrumUsdc, symbol: "USDC", name: "USD Coin", decimals: 6 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  across.mockImplementation(async (path, params) => {
    if (path === "/swap/tokens") {
      const chainId = (params as { chainId?: string }).chainId ?? "";
      return { ok: true, status: 200, payload: tokensByChain[chainId] ?? [] };
    }
    return { ok: true, status: 200, payload: { swapTx: { to: wallet, data: "0x" } } };
  });
});

describe("Across API routes", () => {
  it("proxies chain and token discovery with validated chain input", async () => {
    expect((await chains()).status).toBe(200);
    expect(
      (await tokens(new Request("http://localhost/api/across/tokens?chainId=8453"))).status
    ).toBe(200);
    expect(
      (await tokens(new Request("http://localhost/api/across/tokens?chainId=bad"))).status
    ).toBe(400);
  });

  it("verifies the origin token before requesting a manifest-bound quote", async () => {
    const response = await quote(
      new Request("http://localhost/api/across/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          originChainId: 8_453,
          inputToken: usdc,
          amount: "1000000",
          depositor: wallet,
          recipient: wallet,
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(across).toHaveBeenLastCalledWith(
      "/swap/approval",
      expect.objectContaining({
        destinationChainId: "4663",
        inputToken: usdc,
        outputToken: usdg,
      })
    );
  });

  // The bridge is no longer one-way to the Statics deployment, so an explicit
  // destination has to reach Across intact.
  it("bridges to any requested chain and token", async () => {
    const response = await quote(
      new Request("http://localhost/api/across/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          originChainId: 8_453,
          destinationChainId: 42_161,
          inputToken: usdc,
          outputToken: arbitrumUsdc,
          amount: "1000000",
          depositor: wallet,
          recipient: wallet,
          slippage: 1,
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      destination: { chainId: 42_161, symbol: "USDC", decimals: 6 },
    });
    expect(across).toHaveBeenLastCalledWith(
      "/swap/approval",
      expect.objectContaining({
        originChainId: "8453",
        destinationChainId: "42161",
        outputToken: arbitrumUsdc,
        slippage: "1",
      })
    );
  });

  // Without this the caller picks the output token and Across is asked for a
  // route that cannot exist, so the failure surfaces as an opaque upstream error.
  it("rejects a destination token the destination chain does not route", async () => {
    const response = await quote(
      new Request("http://localhost/api/across/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          originChainId: 8_453,
          destinationChainId: 42_161,
          inputToken: usdc,
          outputToken: usdg,
          amount: "1000000",
          depositor: wallet,
          recipient: wallet,
        }),
      })
    );
    expect(response.status).toBe(400);
    expect(across).not.toHaveBeenCalledWith("/swap/approval", expect.anything());
  });

  it("rejects slippage outside the range the quote routes accept", async () => {
    const response = await quote(
      new Request("http://localhost/api/across/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          originChainId: 8_453,
          inputToken: usdc,
          amount: "1000000",
          depositor: wallet,
          recipient: wallet,
          slippage: 40,
        }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("validates status transaction references before proxying", async () => {
    expect(
      (
        await status(
          new Request(`http://localhost/api/across/status?depositTxnRef=${"0x"}${"ab".repeat(32)}`)
        )
      ).status
    ).toBe(200);
    expect(
      (await status(new Request("http://localhost/api/across/status?depositTxnRef=bad!"))).status
    ).toBe(400);
  });
});
