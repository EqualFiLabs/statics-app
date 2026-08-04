"use client";

import { createContext, useContext } from "react";
import type { Account, Chain, EIP1193Provider, Transport, WalletClient } from "viem";

import { walletClientAccountAddress, walletClientMatchesAddress } from "@/lib/wallet/runtime";

export type WalletRuntimeStatus = "unconfigured" | "loading" | "disconnected" | "ready" | "error";

export type PrivyIdentityStatus =
  "unconfigured" | "loading" | "signed-out" | "authenticated" | "degraded";

export type WalletKind = "embedded" | "external" | null;

export type FundingNetworkSummary = Readonly<{
  chainId: number;
  label: string;
  nativeSymbol: string;
  supportsUniswap: boolean;
}>;

export type WalletConnectorOption = Readonly<{
  id: string;
  name: string;
  kind: "external" | "embedded";
  connected: boolean;
}>;

export type WalletEthereumProvider = EIP1193Provider;
export type ActiveWalletClient = WalletClient<Transport, Chain, Account>;

export type WalletState = Readonly<{
  status: WalletRuntimeStatus;
  identityStatus: PrivyIdentityStatus;
  authenticated: boolean;
  address: string | null;
  walletKind: WalletKind;
  walletClient: ActiveWalletClient | null;
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
  identityError: string | null;
  walletBusyAction: "connect" | "disconnect" | "switch" | "funding-switch" | null;
  identityBusyAction: "create" | "sign-out" | "export" | null;
  busyAction:
    | "connect"
    | "disconnect"
    | "create"
    | "sign-out"
    | "switch"
    | "funding-switch"
    | "export"
    | null;
  walletPickerOpen: boolean;
  walletOptions: readonly WalletConnectorOption[];
  login: () => void;
  connectWallet: () => void;
  closeWalletPicker: () => void;
  connectWalletOption: (id: string) => Promise<void>;
  createWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  signOut: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  selectFundingNetwork: (chainId: number) => Promise<void>;
  getEthereumProvider: () => Promise<WalletEthereumProvider | null>;
  exportWallet: () => Promise<void>;
  copyAddress: () => Promise<void>;
}>;

const unavailable = async () => undefined;

export const defaultWalletState: WalletState = {
  status: "unconfigured",
  identityStatus: "unconfigured",
  authenticated: false,
  address: null,
  walletKind: null,
  walletClient: null,
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
  identityError: null,
  walletBusyAction: null,
  identityBusyAction: null,
  busyAction: null,
  walletPickerOpen: false,
  walletOptions: [],
  login: () => undefined,
  connectWallet: () => undefined,
  closeWalletPicker: () => undefined,
  connectWalletOption: unavailable,
  createWallet: unavailable,
  disconnectWallet: unavailable,
  signOut: unavailable,
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

/**
 * Transaction surfaces consume the normalized signer rather than Wagmi's
 * currently selected connector. This keeps embedded and external wallets on
 * one path and suppresses a stale client during account-change reconciliation.
 */
export function useActiveWalletClient(): { data: ActiveWalletClient | undefined } {
  const wallet = useWalletState();
  const clientAddress = walletClientAccountAddress(wallet.walletClient?.account);
  const matchesActiveAddress = walletClientMatchesAddress(clientAddress, wallet.address);
  return { data: matchesActiveAddress ? wallet.walletClient! : undefined };
}
