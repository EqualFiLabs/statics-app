import { getAddress, type Address, type Hex } from "viem";

import type { Permit2PermitSingle, V4PoolKey } from "@statics-protocol/sdk";
import type { WalletKind } from "@/providers/wallet-context";

export const SWAP_PERMIT_TTL_SECONDS = 20n * 60n;

export type CanonicalSwapDirection = "asset-in" | "basket-in";

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

export function privyPermit2Request<
  T extends {
    readonly types: {
      readonly PermitDetails: readonly {
        readonly name: string;
        readonly type: string;
      }[];
      readonly PermitSingle: readonly {
        readonly name: string;
        readonly type: string;
      }[];
    };
    readonly message: {
      readonly details: {
        readonly amount: bigint;
        readonly expiration: number;
        readonly nonce: number;
      };
      readonly sigDeadline: bigint;
    };
  },
>(typedData: T, address: Address) {
  return {
    typedData: {
      ...typedData,
      types: {
        ...typedData.types,
        PermitDetails: [...typedData.types.PermitDetails],
        PermitSingle: [...typedData.types.PermitSingle],
      },
      message: {
        ...typedData.message,
        details: {
          ...typedData.message.details,
          amount: typedData.message.details.amount.toString(),
          expiration: typedData.message.details.expiration.toString(),
          nonce: typedData.message.details.nonce.toString(),
        },
        sigDeadline: typedData.message.sigDeadline.toString(),
      },
    },
    options: {
      address,
      uiOptions: {
        showWalletUIs: false as const,
      },
    },
  };
}

export async function signPermit2ForWallet<T>({
  walletKind,
  typedData,
  signEmbedded,
  signExternal,
}: {
  walletKind: WalletKind;
  typedData: T;
  signEmbedded: (typedData: T) => Promise<Hex>;
  signExternal: (typedData: T) => Promise<Hex>;
}): Promise<Hex> {
  if (walletKind === "embedded") return signEmbedded(typedData);
  if (walletKind === "external") return signExternal(typedData);
  throw new Error("The connected wallet type is unavailable.");
}
