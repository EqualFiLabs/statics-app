import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/jupiter", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/jupiter")>();
  return {
    ...original,
    callJupiterOrder: vi.fn(),
    callJupiterExecute: vi.fn(),
  };
});

const { POST: quote } = await import("@/app/api/jupiter/quote/route");
const { POST: swap } = await import("@/app/api/jupiter/swap/route");
const { POST: execute } = await import("@/app/api/jupiter/execute/route");
const { callJupiterOrder, callJupiterExecute } = await import("@/lib/server/jupiter");

const order = vi.mocked(callJupiterOrder);
const relay = vi.mocked(callJupiterExecute);
const sol = "So11111111111111111111111111111111111111112";
const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const taker = "9xQeWvG816bUx9EPfSYKcF2qT1D3NEkxkyvTBQ5bB7hq";

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({ ok: true, status: 200, payload: { outAmount: "1" } });
  relay.mockResolvedValue({ ok: true, status: 200, payload: { signature: "signature", code: 0 } });
});

describe("Jupiter API routes", () => {
  it("validates quote and taker inputs before proxying", async () => {
    expect((await quote(post("/api/jupiter/quote", { inputMint: "bad" }))).status).toBe(400);
    expect(
      (
        await swap(
          post("/api/jupiter/swap", {
            inputMint: sol,
            outputMint: usdc,
            amount: "1000",
            taker: "bad",
          })
        )
      ).status
    ).toBe(400);
    expect(order).not.toHaveBeenCalled();
  });

  it("builds mainnet orders and relays bounded signed payloads", async () => {
    expect(
      (
        await swap(
          post("/api/jupiter/swap", {
            inputMint: sol,
            outputMint: usdc,
            amount: "1000",
            taker,
          })
        )
      ).status
    ).toBe(200);
    expect(order).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "1000", taker, slippageBps: 50 })
    );

    expect(
      (
        await execute(
          post("/api/jupiter/execute", {
            signedTransaction: "AQID",
            requestId: "request",
            lastValidBlockHeight: "123",
          })
        )
      ).status
    ).toBe(200);
    expect(relay).toHaveBeenCalledWith(
      expect.objectContaining({ signedTransaction: "AQID", requestId: "request" })
    );
  });
});
