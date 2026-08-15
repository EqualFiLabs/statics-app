import { encodeFunctionData, getAddress, type Address, type Hex } from "viem";

import { basketTokenAbi, type V4PoolKey } from "@statics-protocol/sdk";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";

export const SWAP_PERMIT_TTL_SECONDS = 20n * 60n;

export type CanonicalSwapDirection = "asset-in" | "basket-in";

export function buildMaximumSwapTokenApproval(permit2: Address): Hex {
  return encodeFunctionData({
    abi: basketTokenAbi,
    functionName: "approve",
    args: [permit2, MAX_ERC20_ALLOWANCE],
  });
}

export function isCurrentCanonicalSwapQuote(
  quote:
    | {
        amount: bigint;
        asset: Address;
        direction: CanonicalSwapDirection;
      }
    | null
    | undefined,
  amount: bigint,
  asset: Address,
  direction: CanonicalSwapDirection
): boolean {
  return (
    quote?.amount === amount &&
    quote.asset.toLowerCase() === asset.toLowerCase() &&
    quote.direction === direction
  );
}

export function canonicalSwapPoolKey(pool: {
  currency0: Address;
  currency1: Address;
  lpFee: number;
  tickSpacing: number;
  hook: Address;
}): V4PoolKey {
  return {
    currency0: getAddress(pool.currency0),
    currency1: getAddress(pool.currency1),
    fee: pool.lpFee,
    tickSpacing: pool.tickSpacing,
    hooks: getAddress(pool.hook),
  };
}

export function zeroForExactInput(poolKey: V4PoolKey, inputToken: Address): boolean {
  const input = inputToken.toLowerCase();
  if (poolKey.currency0.toLowerCase() === input) return true;
  if (poolKey.currency1.toLowerCase() === input) return false;
  throw new Error("The selected token is not in this canonical pool.");
}
