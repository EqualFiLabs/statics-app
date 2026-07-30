import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { buildPermit2PermitTypedData } from "@statics-protocol/sdk";

import {
  canonicalSwapPoolKey,
  isCurrentCanonicalSwapQuote,
  permit2SwapApproval,
  privyPermit2Request,
  signPermit2ForWallet,
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

  it("builds an exact bounded Permit2 authorization", () => {
    expect(permit2SwapApproval(token0, 25n, 7, token1, 1_000n)).toEqual({
      details: { token: token0, amount: 25n, expiration: 1_000, nonce: 7 },
      spender: token1,
      sigDeadline: 1_000n,
    });
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

  it("serializes nested Permit2 values for Privy embedded signing", () => {
    const typedData = buildPermit2PermitTypedData(
      46_630,
      token1,
      permit2SwapApproval(token0, 25n, 7, token1, 1_000n)
    );
    const request = privyPermit2Request(typedData, token0);

    expect(() => JSON.stringify(request)).not.toThrow();
    expect(request.typedData.message).toEqual({
      details: {
        token: token0,
        amount: "25",
        expiration: "1000",
        nonce: "7",
      },
      spender: token1,
      sigDeadline: "1000",
    });
    expect(request.options).toEqual({
      address: token0,
      uiOptions: { showWalletUIs: false },
    });
  });

  it("uses Privy only for embedded Permit2 signatures", async () => {
    const calls: string[] = [];
    const signature = await signPermit2ForWallet({
      walletKind: "embedded",
      typedData: "permit",
      signEmbedded: async () => {
        calls.push("embedded");
        return "0x01";
      },
      signExternal: async () => {
        calls.push("external");
        return "0x02";
      },
    });

    expect(signature).toBe("0x01");
    expect(calls).toEqual(["embedded"]);
  });

  it("keeps external Permit2 signatures on the wallet client", async () => {
    const calls: string[] = [];
    const signature = await signPermit2ForWallet({
      walletKind: "external",
      typedData: "permit",
      signEmbedded: async () => {
        calls.push("embedded");
        return "0x01";
      },
      signExternal: async () => {
        calls.push("external");
        return "0x02";
      },
    });

    expect(signature).toBe("0x02");
    expect(calls).toEqual(["external"]);
  });

  it("rejects Permit2 signing without a connected wallet type", async () => {
    await expect(
      signPermit2ForWallet({
        walletKind: null,
        typedData: "permit",
        signEmbedded: async () => "0x01",
        signExternal: async () => "0x02",
      })
    ).rejects.toThrow("The connected wallet type is unavailable.");
  });
});
