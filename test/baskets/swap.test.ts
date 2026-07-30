import { describe, expect, it } from "vitest";
import type { Address } from "viem";

import {
  canonicalSwapPoolKey,
  isCurrentCanonicalSwapQuote,
  zeroForExactInput,
} from "@/lib/baskets/swap";

const token0: Address = "0x0000000000000000000000000000000000000001";
const token1: Address = "0x0000000000000000000000000000000000000002";
const hook: Address = "0x0000000000000000000000000000000000000003";

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

  it("rejects a cached quote after the pool or direction changes", () => {
    const quote = {
      amount: 25n,
      asset: token0,
      direction: "asset-in" as const,
    };

    expect(isCurrentCanonicalSwapQuote(quote, 25n, token0, "asset-in")).toBe(true);
    expect(isCurrentCanonicalSwapQuote(quote, 25n, token1, "asset-in")).toBe(false);
    expect(isCurrentCanonicalSwapQuote(quote, 25n, token0, "basket-in")).toBe(false);
    expect(isCurrentCanonicalSwapQuote(quote, 26n, token0, "asset-in")).toBe(false);
  });
});
