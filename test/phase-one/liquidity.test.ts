import { decodeFunctionData, erc20Abi, getAddress, maxUint256 } from "viem";
import { describe, expect, it } from "vitest";

import { staticsRangeGaugeAbi, v4PoolId, type V4PoolKey } from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment, PublicPoolToken } from "@/lib/deployments/types";
import type { PublicPoolSelection } from "@/lib/phase-one/pools";
import {
  buildProvidePublicLiquidityTransaction,
  buildPublicLiquidityChangeTransaction,
  planPublicLiquidityApprovals,
  quotePublicLiquidity,
  quoteWithdrawalAmounts,
  usableTickBounds,
  validatePublicLiquidityRange,
} from "@/lib/phase-one/liquidity";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const poolKey: V4PoolKey = {
  currency0: address("1"),
  currency1: address("2"),
  fee: 3_000,
  tickSpacing: 60,
  hooks: address("3"),
};
const token = (tokenAddress: `0x${string}`, symbol: string): PublicPoolToken => ({
  address: tokenAddress,
  name: symbol,
  symbol,
  decimals: 18,
  metadataSource: "reviewed-manifest",
});
const pool: PublicPoolSelection = {
  poolId: v4PoolId(poolKey),
  poolKey,
  token0: token(poolKey.currency0, "ONE"),
  token1: token(poolKey.currency1, "TWO"),
  source: "reviewed-registry",
  directOnly: true,
  warning: null,
};
const deployment = {
  contracts: { diamond: address("4") },
} as PhaseOneDeployment;

describe("Phase 1 public liquidity", () => {
  it("uses burn rounding for withdrawal floors even with zero slippage and tiny liquidity", () => {
    expect(quoteWithdrawalAmounts(1n << 96n, -60, 60, 100n)).toEqual({ amount0: 0n, amount1: 0n });
    const principal = quoteWithdrawalAmounts(1n << 96n, -60, 60, 10n ** 18n);
    expect(principal.amount0).toBeGreaterThan(0n);
    expect(principal.amount1).toBeGreaterThan(0n);
  });
  it("validates usable, spacing-aligned concentrated ranges", () => {
    expect(usableTickBounds(60)).toEqual([-887_220, 887_220]);
    expect(validatePublicLiquidityRange(-60, 60, 60, 0).inRange).toBe(true);
    expect(validatePublicLiquidityRange(-120, -60, 60, 0).inRange).toBe(false);
    expect(() => validatePublicLiquidityRange(-61, 60, 60, 0)).toThrow("tick spacing");
    expect(() => validatePublicLiquidityRange(60, -60, 60, 0)).toThrow("usable pool ticks");
  });

  it("quotes liquidity conservatively and encodes provision outside presentation", () => {
    const quote = quotePublicLiquidity({
      sqrtPriceX96: 1n << 96n,
      currentTick: 0,
      tickSpacing: 60,
      tickLower: -60,
      tickUpper: 60,
      amount0Maximum: 10n ** 18n,
      amount1Maximum: 10n ** 18n,
      toleranceBps: 50,
    });
    expect(quote.liquidity).toBeGreaterThan(0n);
    expect(quote.estimatedAmount0).toBeLessThanOrEqual(quote.maximumAmount0);
    expect(quote.estimatedAmount1).toBeLessThanOrEqual(quote.maximumAmount1);

    const transaction = buildProvidePublicLiquidityTransaction({
      deployment,
      pool,
      positionId: 7n,
      quote,
      deadline: 2_000n,
    });
    const decoded = decodeFunctionData({ abi: staticsRangeGaugeAbi, data: transaction.calldata });
    expect(transaction.target).toBe(deployment.contracts.diamond);
    expect(decoded.functionName).toBe("provideLiquidity");
    expect(decoded.args?.[0]).toBe(7n);
    expect(decoded.args?.[1]).toMatchObject({ poolId: pool.poolId });
  });

  it("plans token approvals to the Diamond that pulls liquidity funds", () => {
    const approvals = planPublicLiquidityApprovals({
      deployment,
      pool,
      amount0Maximum: 100n,
      amount1Maximum: 200n,
      allowance0: 0n,
      allowance1: 200n,
    });
    expect(approvals.map((approval) => approval.needed)).toEqual([true, false]);
    const decoded = decodeFunctionData({ abi: erc20Abi, data: approvals[0]!.calldata });
    expect(decoded.args).toEqual([deployment.contracts.diamond, maxUint256]);
  });

  it("encodes increase, decrease, collect, rebalance, and exit against the Diamond", () => {
    const changes = [
      {
        kind: "increase" as const,
        liquidity: 10n,
        amount0Maximum: 100n,
        amount1Maximum: 100n,
      },
      {
        kind: "decrease" as const,
        liquidity: 5n,
        amount0Minimum: 1n,
        amount1Minimum: 1n,
      },
      { kind: "collect" as const, amount0Minimum: 0n, amount1Minimum: 0n },
      {
        kind: "rebalance" as const,
        tickLower: -120,
        tickUpper: 120,
        liquidity: 10n,
        amount0Maximum: 100n,
        amount1Maximum: 100n,
        amount0Minimum: 1n,
        amount1Minimum: 1n,
      },
      { kind: "exit" as const, amount0Minimum: 1n, amount1Minimum: 1n },
    ];
    expect(
      changes.map(
        (change) =>
          decodeFunctionData({
            abi: staticsRangeGaugeAbi,
            data: buildPublicLiquidityChangeTransaction({
              deployment,
              pool,
              positionId: 7n,
              deadline: 2_000n,
              change,
            }).calldata,
          }).functionName
      )
    ).toEqual([
      "increaseLiquidity",
      "decreaseLiquidity",
      "collectNativeFees",
      "rebalanceLiquidity",
      "exitLiquidity",
    ]);
  });
});

describe("user-facing price bounds", () => {
  it("uses full range by default and aligns price bounds with token decimals", async () => {
    const { priceToAlignedTick, tickPrice } = await import("@/lib/phase-one/prices");
    const { parseUnits } = await import("viem");
    expect(usableTickBounds(60)).toEqual([-887220, 887220]);
    expect(priceToAlignedTick(parseUnits("1", 36), 18, 18, 60, "lower")).toBe(0);
    expect(priceToAlignedTick(parseUnits("1.000001", 36), 18, 18, 60, "upper")).toBe(60);
    expect(priceToAlignedTick(parseUnits("1", 36), 6, 18, 60, "lower")).toBeGreaterThan(270000);
    expect(tickPrice(0, 6, 18)).toBe("0.000000000001");
    expect(() => priceToAlignedTick(0n, 18, 18, 60, "lower")).toThrow("greater than zero");
  });
});
