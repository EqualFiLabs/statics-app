import { describe, expect, it } from "vitest";
import { decodeFunctionData, encodeFunctionData, maxUint256, parseAbi } from "viem";

import {
  exactUniswapApproval,
  getDefaultEvmSwapTokens,
  normalizeUniswapTransaction,
} from "@/lib/portal/uniswap";
import {
  getUniswapUniversalRouterVersion,
  readUniswapIntegratorFee,
  resolveUniswapApiKey,
} from "@/lib/server/uniswap";

const wallet = "0x81709E16Bf99936891Cc720689f269103fabeD91";

describe("Uniswap integration", () => {
  it("keeps API credentials and optional fee configuration server-side", async () => {
    await expect(
      resolveUniswapApiKey({ NEXT_PUBLIC_APP_ENV: "production", UNISWAP_API_KEY: "secret" })
    ).resolves.toBe("secret");
    await expect(resolveUniswapApiKey({ NEXT_PUBLIC_APP_ENV: "development" })).rejects.toThrow(
      "server environment"
    );
    expect(readUniswapIntegratorFee({})).toEqual({});
    expect(() => readUniswapIntegratorFee({ UNISWAP_INTEGRATOR_FEE_BIPS: "10" })).toThrow(
      /configured together/i
    );
    expect(
      readUniswapIntegratorFee({
        UNISWAP_INTEGRATOR_FEE_RECIPIENT: wallet,
        UNISWAP_INTEGRATOR_FEE_BIPS: "10",
      })
    ).toEqual({ integratorFee: { recipient: wallet, bips: 10 } });
  });

  it("uses the Robinhood router version and validates returned transactions", () => {
    expect(getUniswapUniversalRouterVersion({ chainId: 4_663 })).toBe("2.1.1");
    expect(getDefaultEvmSwapTokens(8_453).map((token) => token.symbol)).toEqual(["ETH", "USDC"]);
    expect(
      normalizeUniswapTransaction(
        { to: wallet, from: wallet, chainId: 8_453, data: "0x1234", value: "15" },
        { chainId: 8_453, wallet }
      )
    ).toEqual({ to: wallet, data: "0x1234", value: 15n });
    expect(() =>
      normalizeUniswapTransaction(
        { to: wallet, from: wallet, chainId: 1, data: "0x1234" },
        { chainId: 8_453, wallet }
      )
    ).toThrow(/different network/i);
  });

  it("bounds API ERC-20 approval calldata and rejects unexpected targets", () => {
    const abi = parseAbi(["function approve(address spender,uint256 amount)"]);
    const spender = "0x0000000000000000000000000000000000000003";
    const raw = {
      to: wallet,
      from: wallet,
      chainId: 4663,
      data: encodeFunctionData({ abi, functionName: "approve", args: [spender, maxUint256] }),
    };
    const exact = exactUniswapApproval(raw, {
      chainId: 4663,
      wallet,
      token: wallet,
      amount: 10_000_000n,
    });
    expect(decodeFunctionData({ abi, data: exact.data }).args).toEqual([spender, 10_000_000n]);
    expect(() =>
      exactUniswapApproval(
        { ...raw, to: spender },
        {
          chainId: 4663,
          wallet,
          token: wallet,
          amount: 10_000_000n,
        }
      )
    ).toThrow(/unexpected token/i);
    expect(() =>
      exactUniswapApproval(
        { ...raw, data: "0xaaaa" },
        {
          chainId: 4663,
          wallet,
          token: wallet,
          amount: 10_000_000n,
        }
      )
    ).toThrow(/invalid token approval/i);
  });
});
