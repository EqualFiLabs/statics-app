import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/uniswap", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/uniswap")>();
  return { ...original, callUniswapApi: vi.fn() };
});

const { POST: quote } = await import("@/app/api/uniswap/quote/route");
const { POST: approval } = await import("@/app/api/uniswap/check-approval/route");
const { POST: swap } = await import("@/app/api/uniswap/swap/route");
const { callUniswapApi } = await import("@/lib/server/uniswap");

const callApi = vi.mocked(callUniswapApi);
const wallet = "0x81709E16Bf99936891Cc720689f269103fabeD91";
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const native = "0x0000000000000000000000000000000000000000";

function post(pathname: string, body: unknown) {
  return new Request(`http://localhost${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.UNISWAP_INTEGRATOR_FEE_RECIPIENT;
  delete process.env.UNISWAP_INTEGRATOR_FEE_BIPS;
  callApi.mockResolvedValue({ ok: true, status: 200, payload: { requestId: "request" } });
});

describe("Uniswap API routes", () => {
  it("rejects invalid quote and swap input before using the API key", async () => {
    expect(
      (
        await quote(
          post("/api/uniswap/quote", {
            chainId: 999,
            tokenIn: native,
            tokenOut: usdc,
            amount: "1",
            swapper: wallet,
          })
        )
      ).status
    ).toBe(400);
    expect((await swap(post("/api/uniswap/swap", { quote: {} }))).status).toBe(400);
    expect(callApi).not.toHaveBeenCalled();
  });

  it("proxies a same-chain quote with no integrator fee by default", async () => {
    const response = await quote(
      post("/api/uniswap/quote", {
        chainId: 8_453,
        tokenIn: native,
        tokenOut: usdc,
        amount: "1000000000000000",
        swapper: wallet,
      })
    );
    expect(response.status).toBe(200);
    expect(callApi).toHaveBeenCalledWith(
      "/quote",
      expect.objectContaining({
        tokenInChainId: "8453",
        tokenOutChainId: "8453",
        slippageTolerance: 0.5,
      })
    );
    expect(callApi.mock.calls[0]?.[1]).not.toHaveProperty("integratorFee");
  });

  it("skips approval discovery for native assets and validates ERC-20 requests", async () => {
    const nativeResponse = await approval(
      post("/api/uniswap/check-approval", {
        chainId: 8_453,
        token: native,
        tokenOut: usdc,
        amount: "1",
        walletAddress: wallet,
      })
    );
    expect(nativeResponse.status).toBe(200);
    expect(callApi).not.toHaveBeenCalled();

    await approval(
      post("/api/uniswap/check-approval", {
        chainId: 8_453,
        token: usdc,
        tokenOut: native,
        amount: "1000000",
        walletAddress: wallet,
      })
    );
    expect(callApi).toHaveBeenCalledWith(
      "/check_approval",
      expect.objectContaining({ amount: "1000000", chainId: 8_453 })
    );
  });
});
