"use client";

import { createContext, useContext } from "react";
import type { ConnectedWallet } from "@privy-io/react-auth";
import type { Hex } from "viem";

import type { ProtocolTransactionSendRequest } from "@/lib/protocol/transactions";
import type { StaticsNetworkId } from "@/lib/deployments/types";

export type WalletRuntimeStatus =
  "unconfigured" | "loading" | "signed-out" | "wallet-missing" | "ready" | "error";

export type WalletRecoveryAction = "login" | "create-wallet" | null;

export function walletRecoveryAction(status: WalletRuntimeStatus): WalletRecoveryAction {
  if (status === "signed-out" || status === "error") return "login";
  if (status === "wallet-missing") return "create-wallet";
  return null;
}

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
  busyAction: "connect" | "create" | "switch" | "funding-switch" | "export" | null;
  locallyDisconnected: boolean;
  login: () => void;
  connectWallet: () => void;
  connectExternalWallet: () => void;
  disconnectWallet: () => void;
  reconnectWallet: () => Promise<void>;
  createWallet: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  selectNetwork: (networkId: StaticsNetworkId) => Promise<void>;
  selectFundingNetwork: (chainId: number) => Promise<void>;
  getEthereumProvider: () => Promise<WalletEthereumProvider | null>;
  sendEvmTransaction: (request: ProtocolTransactionSendRequest) => Promise<Hex>;
  exportWallet: () => Promise<void>;
  copyAddress: () => Promise<void>;
}>;

const unavailable = async () => undefined;
const unavailableTransaction = async (): Promise<Hex> => {
  throw new Error("The wallet transaction runtime is unavailable.");
};

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
  connectExternalWallet: () => undefined,
  disconnectWallet: () => undefined,
  reconnectWallet: unavailable,
  createWallet: unavailable,
  switchNetwork: unavailable,
  selectNetwork: unavailable,
  selectFundingNetwork: unavailable,
  getEthereumProvider: async () => null,
  sendEvmTransaction: unavailableTransaction,
  exportWallet: unavailable,
  copyAddress: unavailable,
};

export const WalletContext = createContext<WalletState>(defaultWalletState);

export function useWalletState(): WalletState {
  return useContext(WalletContext);
}
