"use client";

import { getAddress, isAddress, type Address } from "viem";

import { readClientDollarDeployment } from "@/lib/dollar/deployment";
import { getDefaultEvmSwapTokens } from "@/lib/portal/uniswap";
import { getTokenListEntry } from "@/lib/token-list";

export type WalletToken = Readonly<{
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isDefault?: boolean;
}>;

const storageEvent = "statics-wallet-tokens-changed";

export function walletTokenStorageKey(chainId: number) {
  return `statics:wallet:tokens:${chainId}`;
}

export function defaultWalletTokens(chainId: number): WalletToken[] {
  const defaults: WalletToken[] = getDefaultEvmSwapTokens(chainId)
    .filter((token) => token.kind === "erc20")
    .map((token) => {
      const catalog = getTokenListEntry(chainId, token.address);
      return {
        address: token.address,
        symbol: catalog?.symbol ?? token.symbol,
        name: catalog?.name ?? token.name,
        decimals: catalog?.decimals ?? token.decimals,
        logoURI: catalog?.logoURI,
        isDefault: true,
      };
    });
  const deployment = readClientDollarDeployment();
  if (deployment.status === "configured" && deployment.deployment.chainId === chainId) {
    if (deployment.deployment.pegged) {
      defaults.push({
        address: deployment.deployment.pegged.collateral,
        symbol: "USDG",
        name: "Global Dollar",
        decimals: 6,
        isDefault: true,
      });
    }
    defaults.push({
      address: deployment.deployment.contracts.dollar,
      symbol: "sUSD",
      name: "Statics Dollar",
      decimals: 18,
      isDefault: true,
    });
  }
  return defaults.filter(
    (token, index, tokens) =>
      tokens.findIndex((candidate) => candidate.address === token.address) === index
  );
}

export function loadWalletTokens(chainId: number): WalletToken[] {
  if (typeof window === "undefined") return defaultWalletTokens(chainId);
  let stored: WalletToken[] = [];
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(walletTokenStorageKey(chainId)) ?? "[]"
    );
    if (Array.isArray(parsed)) {
      stored = parsed.flatMap((value): WalletToken[] => {
        if (
          !value ||
          typeof value !== "object" ||
          !("address" in value) ||
          typeof value.address !== "string" ||
          !isAddress(value.address)
        ) {
          return [];
        }
        const record = value as Record<string, unknown>;
        if (
          typeof record.symbol !== "string" ||
          typeof record.name !== "string" ||
          !Number.isInteger(record.decimals)
        ) {
          return [];
        }
        const catalog = getTokenListEntry(chainId, value.address);
        return [
          {
            address: getAddress(value.address),
            symbol: catalog?.symbol ?? record.symbol,
            name: catalog?.name ?? record.name,
            decimals: catalog?.decimals ?? Number(record.decimals),
            logoURI: catalog?.logoURI,
          },
        ];
      });
    }
  } catch {
    stored = [];
  }
  return [...defaultWalletTokens(chainId), ...stored].filter(
    (token, index, tokens) =>
      tokens.findIndex(
        (candidate) => candidate.address.toLowerCase() === token.address.toLowerCase()
      ) === index
  );
}

export function saveWalletTokens(chainId: number, tokens: readonly WalletToken[]) {
  window.localStorage.setItem(
    walletTokenStorageKey(chainId),
    JSON.stringify(tokens.filter((token) => !token.isDefault))
  );
  window.dispatchEvent(new CustomEvent(storageEvent));
}

export function subscribeWalletTokens(listener: () => void) {
  window.addEventListener(storageEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(storageEvent, listener);
    window.removeEventListener("storage", listener);
  };
}
