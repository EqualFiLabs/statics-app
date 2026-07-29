import { describe, expect, it } from "vitest";

import { canonicalSwapPoolKey, permit2SwapApproval, zeroForExactInput } from "@/lib/baskets/swap";

const token0 = "0x0000000000000000000000000000000000000001";
const token1 = "0x0000000000000000000000000000000000000002";
const hook = "0x0000000000000000000000000000000000000003";

describe("canonical basket swaps", () => {
  const poolKey = canonicalSwapPoolKey({
    currency0: token0,
    currency1: token1,
    lpFee: 3_000,
    tickSpacing: 10,
    hook,
  });

  it("derives exact-input direction from the canonical currencies", () => {
    expect(zeroForExactInput(poolKey, token0)).toBe(true);
    expect(zeroForExactInput(poolKey, token1)).toBe(false);
  });

  it("builds an exact bounded Permit2 authorization", () => {
    expect(permit2SwapApproval(token0, 25n, 7, token1, 1_000n)).toEqual({
      details: { token: token0, amount: 25n, expiration: 1_000, nonce: 7 },
      spender: token1,
      sigDeadline: 1_000n,
    });
  });
});
