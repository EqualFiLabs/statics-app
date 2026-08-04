import { parseSignature, type Hex } from "viem";

import type { PermitSignature } from "@statics-protocol/sdk";
import type { WalletKind } from "@/providers/wallet-context";

export const PERMIT_TTL_SECONDS = 20n * 60n;

export function permitDeadline(blockTimestamp: bigint): bigint {
  return blockTimestamp + PERMIT_TTL_SECONDS;
}

export function exactPeggedMintPermitValue(
  freshCollateralIn: bigint,
  reviewedMaximumCollateralIn: bigint
): bigint {
  if (freshCollateralIn > reviewedMaximumCollateralIn) {
    throw new Error("The required USDG moved above the reviewed maximum.");
  }
  return freshCollateralIn;
}

export function privyPermitRequest<
  T extends {
    readonly types: {
      readonly Permit: readonly {
        readonly name: string;
        readonly type: string;
      }[];
    };
    readonly message: {
      readonly value: bigint;
      readonly nonce: bigint;
      readonly deadline: bigint;
    };
  },
>(typedData: T, address: `0x${string}`) {
  return {
    typedData: {
      ...typedData,
      types: {
        ...typedData.types,
        Permit: [...typedData.types.Permit],
      },
      message: {
        ...typedData.message,
        value: typedData.message.value.toString(),
        nonce: typedData.message.nonce.toString(),
        deadline: typedData.message.deadline.toString(),
      },
    },
    options: {
      address,
      uiOptions: {
        showWalletUIs: true as const,
        title: "Approve unlimited token spending",
        description:
          "Sign a maximum token allowance for the Statics Dollar Gateway. The signature expires in 20 minutes, but an executed allowance remains active until consumed or revoked in Approval Tools.",
        buttonText: "Sign approval",
        isCancellable: true as const,
      },
    },
  };
}

export async function signPermitForWallet<T>({
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

export function decodePermitSignature(
  value: bigint,
  deadline: bigint,
  signature: Hex
): PermitSignature {
  const decoded = parseSignature(signature);
  const v =
    decoded.v !== undefined
      ? Number(decoded.v)
      : decoded.yParity !== undefined
        ? 27 + decoded.yParity
        : undefined;
  if (v !== 27 && v !== 28) throw new Error("Wallet returned an invalid permit signature.");
  return { value, deadline, v, r: decoded.r, s: decoded.s };
}
