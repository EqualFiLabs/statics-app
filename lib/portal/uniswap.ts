import { getAddress, isAddress, zeroAddress, type Address, type Hex } from "viem";

import { getFundingNetwork } from "@/lib/funding-networks";

export type EvmSwapToken = Readonly<{
  address: Address;
  decimals: number;
  kind: "native" | "erc20";
  name: string;
  symbol: string;
}>;

export type UniswapTransaction = Readonly<{
  to: Address;
  data: Hex;
  value: bigint;
}>;

type RawTransaction = Record<string, unknown>;

const STABLE_TOKENS: Readonly<Record<number, Omit<EvmSwapToken, "kind">>> = {
  1: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  10: {
    address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  56: {
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18,
    name: "USD Coin",
    symbol: "USDC",
  },
  130: {
    address: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  137: {
    address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  143: {
    address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  324: {
    address: "0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  480: {
    address: "0x79A02482A880bCe3F13E09da970dC34dB4cD24D1",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  4_663: {
    address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    decimals: 6,
    name: "Global Dollar",
    symbol: "USDG",
  },
  8_453: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  42_161: {
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  42_220: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  43_114: {
    address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  59_144: {
    address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
};

export const UNISWAP_SWAP_CHAIN_IDS = new Set([
  1, 10, 56, 130, 137, 143, 196, 324, 480, 1_301, 1_868, 4_217, 4_663, 8_453, 10_143, 42_161,
  42_220, 43_114, 59_144, 81_457, 7_777_777,
]);

export function isUniswapSwapChainId(value: unknown): value is number {
  return typeof value === "number" && UNISWAP_SWAP_CHAIN_IDS.has(value);
}

export function getDefaultEvmSwapTokens(chainId: number): EvmSwapToken[] {
  const network = getFundingNetwork(chainId);
  if (!network) return [];
  const native: EvmSwapToken = {
    address: zeroAddress,
    decimals: network.chain.nativeCurrency.decimals,
    kind: "native",
    name: network.chain.nativeCurrency.name,
    symbol: network.chain.nativeCurrency.symbol,
  };
  const stable = STABLE_TOKENS[chainId];
  return stable ? [native, { ...stable, kind: "erc20" }] : [native];
}

function quantity(value: unknown, label: string): bigint {
  if (value === undefined || value === null || value === "") return 0n;
  if (
    (typeof value === "string" && (/^[0-9]+$/.test(value) || /^0x[0-9a-fA-F]+$/.test(value))) ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
  ) {
    return BigInt(value);
  }
  throw new Error(`Uniswap returned an invalid ${label}.`);
}

export function normalizeUniswapTransaction(
  value: unknown,
  expected: { chainId: number; wallet: Address }
): UniswapTransaction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Uniswap did not return a transaction.");
  }
  const tx = value as RawTransaction;
  if (typeof tx.to !== "string" || !isAddress(tx.to)) {
    throw new Error("Uniswap returned an invalid transaction target.");
  }
  if (typeof tx.data !== "string" || !/^0x[0-9a-fA-F]*$/.test(tx.data)) {
    throw new Error("Uniswap returned invalid transaction calldata.");
  }
  if (
    tx.from !== undefined &&
    (typeof tx.from !== "string" ||
      !isAddress(tx.from) ||
      getAddress(tx.from) !== getAddress(expected.wallet))
  ) {
    throw new Error("Uniswap returned a transaction for a different wallet.");
  }
  if (tx.chainId !== undefined && Number(tx.chainId) !== expected.chainId) {
    throw new Error("Uniswap returned a transaction for a different network.");
  }
  return {
    to: getAddress(tx.to),
    data: tx.data as Hex,
    value: quantity(tx.value, "transaction value"),
  };
}

export function uniswapError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  return (
    [record.detail, record.error, record.message].find(
      (value): value is string => typeof value === "string" && value.length > 0
    ) ?? fallback
  );
}
