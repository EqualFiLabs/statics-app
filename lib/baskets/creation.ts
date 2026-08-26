import type { Address } from "viem";

import {
  backingAtSupply,
  encodeSqrtPriceAssetPerBasketX96,
  maximumLiquidityForAmounts,
  mulDivUp,
  quoteRangeAmounts,
} from "@statics-protocol/sdk";

import { canonicalFullRange } from "@/lib/liquidity/liquidity";

const MAX_UINT128 = (1n << 128n) - 1n;
const SHARE_SCALE = 10n ** 18n;
const BPS = 10_000n;

export type BasketLaunchAssetInput = Readonly<{
  address: Address;
  symbol: string;
  decimals: number;
  bundleAmount: bigint;
  assetPerBasket: bigint;
  seedAssetAmount: bigint;
  walletBalance: bigint;
}>;

export type BasketLaunchAssetQuote = BasketLaunchAssetInput &
  Readonly<{
    sqrtPriceAssetPerBasketX96: bigint;
    liquidity: bigint;
    poolBasketAmount: bigint;
    poolAssetAmount: bigint;
    backingAmount: bigint;
    mintFeeAmount: bigint;
    requiredAmount: bigint;
    maximumAmount: bigint;
    shortfall: bigint;
  }>;

export type BasketLaunchQuote = Readonly<{
  basketShares: bigint;
  assets: readonly BasketLaunchAssetQuote[];
}>;

/** Mirrors the fresh-basket launch arithmetic used by BasketLiquidityFacet. */
export function calculateBasketLaunchQuote(
  inputs: readonly BasketLaunchAssetInput[],
  mintFeeShares: bigint,
  slippageBps: bigint
): BasketLaunchQuote | null {
  if (
    !inputs.length ||
    inputs.length > 16 ||
    mintFeeShares < 0n ||
    slippageBps < 0n ||
    slippageBps > 500n
  ) {
    return null;
  }
  const [tickLower, tickUpper] = canonicalFullRange(10);
  const pools = inputs.map((input) => {
    if (input.bundleAmount <= 0n || input.assetPerBasket <= 0n || input.seedAssetAmount <= 0n) {
      return null;
    }
    try {
      // The user-facing price is always asset per one 18-decimal BasketToken.
      // This logical orientation is invariant to the pool's address sorting;
      // the protocol applies the same inversion when asset becomes currency0.
      const sqrtPriceAssetPerBasketX96 = encodeSqrtPriceAssetPerBasketX96(
        input.assetPerBasket,
        SHARE_SCALE
      );
      const liquidity = maximumLiquidityForAmounts(
        sqrtPriceAssetPerBasketX96,
        tickLower,
        tickUpper,
        MAX_UINT128,
        input.seedAssetAmount
      );
      if (liquidity <= 0n || liquidity > MAX_UINT128) return null;
      const amounts = quoteRangeAmounts(
        sqrtPriceAssetPerBasketX96,
        tickLower,
        tickUpper,
        liquidity
      );
      if (amounts.amount0 <= 0n || amounts.amount1 <= 0n) return null;
      return {
        input,
        sqrtPriceAssetPerBasketX96,
        liquidity,
        poolBasketAmount: amounts.amount0,
        poolAssetAmount: amounts.amount1,
      };
    } catch {
      return null;
    }
  });
  if (pools.some((pool) => pool === null)) return null;
  const validPools = pools as readonly NonNullable<(typeof pools)[number]>[];
  const basketShares = validPools.reduce((sum, pool) => sum + pool.poolBasketAmount, 0n);
  if (basketShares <= 0n) return null;
  return {
    basketShares,
    assets: validPools.map((pool) => {
      const backingAmount = backingAtSupply(pool.input.bundleAmount, basketShares);
      const mintFeeAmount = mulDivUp(pool.input.bundleAmount, mintFeeShares, SHARE_SCALE);
      const requiredAmount = pool.poolAssetAmount + backingAmount + mintFeeAmount;
      // The protocol uses a strict `< maximum` launch check for the pool leg,
      // so the one-unit floor also protects zero-slippage launches.
      const maximumAmount = mulDivUp(requiredAmount, BPS + slippageBps, BPS) + 1n;
      return {
        ...pool.input,
        sqrtPriceAssetPerBasketX96: pool.sqrtPriceAssetPerBasketX96,
        liquidity: pool.liquidity,
        poolBasketAmount: pool.poolBasketAmount,
        poolAssetAmount: pool.poolAssetAmount,
        backingAmount,
        mintFeeAmount,
        requiredAmount,
        maximumAmount,
        shortfall:
          requiredAmount > pool.input.walletBalance
            ? requiredAmount - pool.input.walletBalance
            : 0n,
      };
    }),
  };
}
