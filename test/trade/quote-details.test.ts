import { getAddress, zeroAddress, type PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  noImpactOutput,
  priceImpactPercent,
  readPricedHops,
  routeHops,
  v4SwapFee,
} from "@/lib/trade/quote-details";

const Q96 = 1n << 96n;
const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const flat = {
  zeroForOne: true,
  sqrtPriceX96: Q96,
  swapFeePips: 0n,
  inputFeePips: 0n,
  outputFeePips: 0n,
};

describe("swap quote details", () => {
  it("combines the directional protocol fee with the LP fee as v4-core does", () => {
    expect(v4SwapFee(0, 3_000, true)).toBe(3_000n);
    // 0.1% protocol fee for zeroForOne in the low 12 bits, 0.2% for oneForZero above them.
    const protocolFee = 1_000 | (2_000 << 12);
    expect(v4SwapFee(protocolFee, 3_000, true)).toBe(1_000n + 3_000n - 3n);
    expect(v4SwapFee(protocolFee, 3_000, false)).toBe(2_000n + 3_000n - 6n);
  });

  it("applies the Statics input fee, the swap fee, the pool price and the output fee in order", () => {
    // Price 4 (sqrt 2): 1,000,000 in, minus 0.05% in, 0.3% swap, x4, minus 0.05% out.
    const hop = {
      ...flat,
      sqrtPriceX96: 2n * Q96,
      swapFeePips: 3_000n,
      inputFeePips: 500n,
      outputFeePips: 500n,
    };
    expect(noImpactOutput(1_000_000n, [hop])).toBe(3_984_010n);
    expect(
      noImpactOutput(4_000_000n, [
        { ...hop, zeroForOne: false, swapFeePips: 0n, inputFeePips: 0n, outputFeePips: 0n },
      ])
    ).toBe(1_000_000n);
  });

  it("reports only the shortfall from moving the price, never a negative impact", () => {
    expect(priceImpactPercent(1_000_000n, 990_000n, [flat])).toBe(1);
    expect(priceImpactPercent(1_000_000n, 1_000_001n, [flat])).toBe(0);
  });

  it("derives each hop's direction from the currency it receives", () => {
    const route = { inputToken: address("3"), poolKey: {} as never, zeroForOne: true };
    const hop = (to: string) => ({
      poolId: `0x${"a".repeat(64)}` as const,
      intermediateCurrency: address(to),
      fee: 3_000,
      tickSpacing: 60,
      hooks: zeroAddress,
      reviewed: true,
    });
    expect(routeHops(route, [hop("5"), hop("1")]).map((h) => h.zeroForOne)).toEqual([true, false]);
  });

  it("declines when another hook can take a share of the swap", async () => {
    const client = { readContract: vi.fn() } as unknown as PublicClient;
    // Low bits 0b0100: afterSwapReturnDelta.
    const doppler = getAddress("0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544");
    const hops = [
      { poolId: `0x${"a".repeat(64)}` as const, zeroForOne: true, fee: 15_000, hooks: doppler },
    ];
    await expect(
      readPricedHops(client, { stateView: address("7"), staticsHook: address("9") }, hops)
    ).resolves.toBeNull();
    expect(client.readContract).not.toHaveBeenCalled();
  });

  it("reads Statics fee rates for Statics pools and none for hookless pools", async () => {
    const read = vi.fn(async ({ functionName }) =>
      functionName === "getSlot0"
        ? [Q96, 0, 0, 3_000]
        : { inputFeePips: 10, outputFeePips: 20, overridden: true }
    );
    const client = { readContract: read } as unknown as PublicClient;
    const poolId = `0x${"a".repeat(64)}` as const;
    const priced = await readPricedHops(
      client,
      { stateView: address("7"), staticsHook: address("9") },
      [
        { poolId, zeroForOne: true, fee: 3_000, hooks: address("9") },
        { poolId, zeroForOne: false, fee: 3_000, hooks: zeroAddress },
      ]
    );
    expect(priced?.map((h) => [h.inputFeePips, h.outputFeePips, h.swapFeePips])).toEqual([
      [10n, 20n, 3_000n],
      [0n, 0n, 3_000n],
    ]);
  });
});
