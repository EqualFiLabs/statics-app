import { parseSignature, type Hex } from "viem";

import type { PermitSignature } from "@statics-protocol/sdk";

export const PERMIT_TTL_SECONDS = 20n * 60n;

export function permitDeadline(blockTimestamp: bigint): bigint {
  return blockTimestamp + PERMIT_TTL_SECONDS;
}

export function decodePermitSignature(deadline: bigint, signature: Hex): PermitSignature {
  const decoded = parseSignature(signature);
  const v =
    decoded.v !== undefined
      ? Number(decoded.v)
      : decoded.yParity !== undefined
        ? 27 + decoded.yParity
        : undefined;
  if (v !== 27 && v !== 28) throw new Error("Wallet returned an invalid permit signature.");
  return { deadline, v, r: decoded.r, s: decoded.s };
}
