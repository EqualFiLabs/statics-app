import generatedTokenList from "@/lib/generated/token-list.json";
import type { Address } from "viem";

export type TokenListEntry = Readonly<{
  chainId: number;
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  bridgeInfo?: Record<number, { tokenAddress: Address }>;
}>;

const generated = generatedTokenList as {
  tokens: TokenListEntry[];
  supportedChainIds: number[];
};

if (!Array.isArray(generated.tokens)) {
  throw new Error("Invalid generated token list artifact.");
}

const tierOne = new Set(["USDC", "USDT", "DAI", "WETH", "WBTC", "USDG"]);
const tierTwo = new Set([
  "UNI",
  "AAVE",
  "LINK",
  "CRV",
  "MKR",
  "SNX",
  "COMP",
  "LDO",
  "ARB",
  "OP",
  "MATIC",
  "GMX",
  "PENDLE",
]);

function key(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}`;
}

export const TOKEN_LIST: TokenListEntry[] = [];
export const TOKENS_BY_CHAIN = new Map<number, TokenListEntry[]>();
export const TOKEN_BY_ADDRESS = new Map<string, TokenListEntry>();
const order = new Map<string, number>();

for (const [index, token] of generated.tokens.entries()) {
  if (
    !token ||
    !Number.isSafeInteger(token.chainId) ||
    typeof token.address !== "string" ||
    typeof token.symbol !== "string" ||
    typeof token.name !== "string" ||
    !Number.isInteger(token.decimals)
  ) {
    throw new Error(`Invalid token catalog entry ${index}.`);
  }
  const tokenKey = key(token.chainId, token.address);
  if (TOKEN_BY_ADDRESS.has(tokenKey)) continue;
  TOKEN_LIST.push(token);
  TOKEN_BY_ADDRESS.set(tokenKey, token);
  TOKENS_BY_CHAIN.set(token.chainId, [...(TOKENS_BY_CHAIN.get(token.chainId) ?? []), token]);
  order.set(tokenKey, index);
}

export function getTokenListEntry(chainId: number, address: string) {
  return TOKEN_BY_ADDRESS.get(key(chainId, address)) ?? null;
}

export function getTokenTier(token: TokenListEntry): 1 | 2 | 3 {
  const symbol = token.symbol.toUpperCase();
  return tierOne.has(symbol) ? 1 : tierTwo.has(symbol) ? 2 : 3;
}

export function sortTokenListEntries(left: TokenListEntry, right: TokenListEntry) {
  return (
    getTokenTier(left) - getTokenTier(right) ||
    (order.get(key(left.chainId, left.address)) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(key(right.chainId, right.address)) ?? Number.MAX_SAFE_INTEGER) ||
    left.symbol.localeCompare(right.symbol)
  );
}

export function searchTokenList(
  chainId: number,
  search: string,
  excludedAddresses: readonly string[] = []
) {
  const query = search.trim().toLowerCase();
  const excluded = new Set(excludedAddresses.map((address) => address.toLowerCase()));
  return (TOKENS_BY_CHAIN.get(chainId) ?? [])
    .filter((token) => !excluded.has(token.address.toLowerCase()))
    .filter((token) => query || getTokenTier(token) !== 3)
    .filter(
      (token) =>
        !query ||
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
    )
    .sort(sortTokenListEntries);
}
