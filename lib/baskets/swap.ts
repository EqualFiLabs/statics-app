import { getAddress, type Address } from "viem";

import type { Permit2PermitSingle, V4PoolKey } from "@statics-protocol/sdk";

export const SWAP_PERMIT_TTL_SECONDS = 20n * 60n;

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

export function permit2SwapApproval(
  token: Address,
  amount: bigint,
  nonce: number,
  router: Address,
  deadline: bigint
): Permit2PermitSingle {
  if (deadline > BigInt(0xffff_ffff_ffff)) throw new Error("Permit2 deadline exceeds uint48.");
  return {
    details: {
      token,
      amount,
      expiration: Number(deadline),
      nonce,
    },
    spender: router,
    sigDeadline: deadline,
  };
}
