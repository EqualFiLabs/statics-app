"use client";

import { createContext, useContext } from "react";
import type { ConnectedWallet } from "@privy-io/react-auth";

export type WalletRuntimeStatus =
  "unconfigured" | "loading" | "signed-out" | "wallet-missing" | "ready" | "error";

export type WalletKind = "embedded" | "external" | null;

export type FundingNetworkSummary = Readonly<{
  chainId: number;
  label: string;
  nativeSymbol: string;
  supportsUniswap: boolean;
}>;

export type WalletEthereumProvider = Awaited<ReturnType<ConnectedWallet["getEthereumProvider"]>>;

export type WalletState = Readonly<{
  status: WalletRuntimeStatus;
  authenticated: boolean;
  address: string | null;
  walletKind: WalletKind;
  networkName: string;
  chainId: number | null;
  targetChainId: number;
  isTargetChain: boolean;
  fundingChainId: number;
  fundingNetworkName: string;
  fundingWalletOnSelectedChain: boolean;
  fundingNetworks: readonly FundingNetworkSummary[];
  explorerUrl: string | null;
  error: string | null;
  busyAction: "create" | "switch" | "funding-switch" | "export" | null;
  locallyDisconnected: boolean;
  login: () => void;
  connectWallet: () => void;
  disconnectWallet: () => void;
  reconnectWallet: () => void;
  createWallet: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  selectFundingNetwork: (chainId: number) => Promise<void>;
  getEthereumProvider: () => Promise<WalletEthereumProvider | null>;
  exportWallet: () => Promise<void>;
  copyAddress: () => Promise<void>;
}>;

const unavailable = async () => undefined;

export const defaultWalletState: WalletState = {
  status: "unconfigured",
  authenticated: false,
  address: null,
  walletKind: null,
  networkName: "Robinhood Chain Testnet",
  chainId: null,
  targetChainId: 46_630,
  isTargetChain: false,
  fundingChainId: 8_453,
  fundingNetworkName: "Base",
  fundingWalletOnSelectedChain: false,
  fundingNetworks: [],
  explorerUrl: null,
  error: null,
  busyAction: null,
  locallyDisconnected: false,
  login: () => undefined,
  connectWallet: () => undefined,
  disconnectWallet: () => undefined,
  reconnectWallet: () => undefined,
  createWallet: unavailable,
  switchNetwork: unavailable,
  selectFundingNetwork: unavailable,
  getEthereumProvider: async () => null,
  exportWallet: unavailable,
  copyAddress: unavailable,
};

export const WalletContext = createContext<WalletState>(defaultWalletState);

export function useWalletState(): WalletState {
  return useContext(WalletContext);
}
