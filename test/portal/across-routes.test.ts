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

beforeEach(() => {
  vi.clearAllMocks();
  across.mockImplementation(async (path) => {
    if (path === "/swap/tokens") {
      return {
        ok: true,
        status: 200,
        payload: [{ chainId: 8_453, address: usdc, symbol: "USDC", name: "USD Coin", decimals: 6 }],
      };
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
        outputToken: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
      })
    );
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
