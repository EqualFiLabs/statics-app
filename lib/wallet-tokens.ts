"use client";

import { getAddress, isAddress, type Address } from "viem";

import { readClientDollarDeployment, type DollarDeploymentState } from "@/lib/dollar/deployment";
import { getDefaultEvmSwapTokens } from "@/lib/portal/uniswap";
import {
  EVE_LOCAL_DECIMALS,
  EVE_NAME,
  EVE_SYMBOL,
  getEveBridgeDeployment,
} from "@/lib/portal/eve-bridge";
import { getTokenListEntry } from "@/lib/token-list";
import type { StaticsDeployment } from "@/lib/deployments/types";

export type WalletToken = Readonly<{
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isDefault?: boolean;
}>;

const storageEvent = "statics-wallet-tokens-changed";

export function walletTokenStorageKey(chainId: number, deploymentId = "shared") {
  return `statics:wallet:tokens:${chainId}:${deploymentId}`;
}

export function defaultWalletTokens(
  chainId: number,
  deployment: DollarDeploymentState | StaticsDeployment = readClientDollarDeployment()
): WalletToken[] {
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
  const eve = getEveBridgeDeployment(chainId);
  if (eve) {
    defaults.push({
      address: eve.tokenAddress,
      symbol: EVE_SYMBOL,
      name: EVE_NAME,
      decimals: EVE_LOCAL_DECIMALS,
      isDefault: true,
    });
  }
  const protocolDeployment =
    "kind" in deployment && deployment.kind === "protocol"
      ? deployment.protocol
      : "status" in deployment && deployment.status === "configured"
        ? deployment.deployment
        : null;
  const launchDeployment = "kind" in deployment && deployment.kind === "launch" ? deployment : null;
  if (launchDeployment?.descriptor.chainId === chainId) {
    defaults.push(
      {
        address: launchDeployment.contracts.statics,
        symbol: "STATICS",
        name: "Statics",
        decimals: 18,
        isDefault: true,
      },
      {
        address: launchDeployment.contracts.weth,
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        isDefault: true,
      }
    );
  }
  if (protocolDeployment?.chainId === chainId) {
    if (protocolDeployment.pegged) {
      defaults.push({
        address: protocolDeployment.pegged.collateral,
        symbol: "USDG",
        name: "Global Dollar",
        decimals: 6,
        isDefault: true,
      });
    }
    defaults.push({
      address: protocolDeployment.contracts.dollar,
      symbol: "USDstx",
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

export function loadWalletTokens(
  chainId: number,
  deployment?: StaticsDeployment | null
): WalletToken[] {
  const deploymentId = deployment?.descriptor.deploymentId ?? "shared";
  if (typeof window === "undefined")
    return defaultWalletTokens(chainId, deployment ?? readClientDollarDeployment());
  let stored: WalletToken[] = [];
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(walletTokenStorageKey(chainId, deploymentId)) ?? "[]"
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
  return [
    ...defaultWalletTokens(chainId, deployment ?? readClientDollarDeployment()),
    ...stored,
  ].filter(
    (token, index, tokens) =>
      tokens.findIndex(
        (candidate) => candidate.address.toLowerCase() === token.address.toLowerCase()
      ) === index
  );
}

export function saveWalletTokens(
  chainId: number,
  tokens: readonly WalletToken[],
  deploymentId = "shared"
) {
  window.localStorage.setItem(
    walletTokenStorageKey(chainId, deploymentId),
    JSON.stringify(tokens.filter((token) => !token.isDefault))
  );
  window.dispatchEvent(new CustomEvent(storageEvent));
}

export function mergeWalletTokens(
  current: readonly WalletToken[],
  additions: readonly WalletToken[]
): WalletToken[] {
  const addresses = new Set(current.map((token) => token.address.toLowerCase()));
  return [
    ...current,
    ...additions.filter((token) => {
      const address = token.address.toLowerCase();
      if (addresses.has(address)) return false;
      addresses.add(address);
      return true;
    }),
  ];
}

export function subscribeWalletTokens(listener: () => void) {
  window.addEventListener(storageEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(storageEvent, listener);
    window.removeEventListener("storage", listener);
  };
}
