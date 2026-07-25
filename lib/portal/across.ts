import { getAddress, isAddress, type Address, type Hex } from "viem";

import { readClientDollarDeployment } from "@/lib/dollar/deployment";

export const ACROSS_SOLANA_CHAIN_ID = 34_268_394_551_451;

export type AcrossChain = Readonly<{
  chainId: number;
  name: string;
  logoUrl?: string;
  explorerUrl?: string;
}>;

export type AcrossToken = Readonly<{
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl?: string;
  priceUsd?: string;
}>;

export type AcrossTransaction = Readonly<{
  to: Address;
  data: Hex;
  value: bigint;
  chainId: number;
}>;

export function readAcrossDestination() {
  let deployment;
  try {
    deployment = readClientDollarDeployment();
  } catch {
    deployment = { status: "unavailable" as const, reason: "Invalid deployment configuration." };
  }
  if (
    deployment.status !== "configured" ||
    deployment.deployment.chainId !== 4_663 ||
    !deployment.deployment.pegged
  ) {
    return {
      status: "unavailable" as const,
      chainId: 4_663,
      chainName: "Robinhood Chain",
      symbol: "USDG",
    };
  }
  return {
    status: "configured" as const,
    chainId: deployment.deployment.chainId,
    chainName: "Robinhood Chain",
    token: deployment.deployment.pegged.collateral,
    symbol: "USDG",
    decimals: 6,
  };
}

export function normalizeAcrossTransaction(
  value: unknown,
  expected: { chainId: number; wallet: Address }
): AcrossTransaction {
  if (!value || typeof value !== "object") throw new Error("Across returned no transaction.");
  const record = value as Record<string, unknown>;
  if (typeof record.to !== "string" || !isAddress(record.to)) {
    throw new Error("Across returned an invalid transaction target.");
  }
  if (typeof record.data !== "string" || !/^0x[0-9a-fA-F]*$/.test(record.data)) {
    throw new Error("Across returned invalid transaction data.");
  }
  const chainId = Number(record.chainId);
  if (chainId !== expected.chainId) {
    throw new Error("Across returned a transaction for a different origin chain.");
  }
  if (
    record.from !== undefined &&
    (typeof record.from !== "string" ||
      !isAddress(record.from) ||
      getAddress(record.from) !== expected.wallet)
  ) {
    throw new Error("Across returned a transaction for a different wallet.");
  }
  const rawValue = record.value ?? "0";
  if (!(
    (typeof rawValue === "string" &&
      (/^[0-9]+$/.test(rawValue) || /^0x[0-9a-fA-F]+$/.test(rawValue))) ||
    (typeof rawValue === "number" && Number.isSafeInteger(rawValue) && rawValue >= 0)
  )) {
    throw new Error("Across returned an invalid transaction value.");
  }
  return {
    to: getAddress(record.to),
    data: record.data as Hex,
    value: BigInt(rawValue),
    chainId,
  };
}

export function acrossError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  return (
    [record.detail, record.message, record.error].find(
      (value): value is string => typeof value === "string" && value.length > 0
    ) ?? fallback
  );
}
