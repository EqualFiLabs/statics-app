"use client";

import { createContext, useContext } from "react";

export type WalletRuntimeStatus =
  "unconfigured" | "loading" | "signed-out" | "wallet-missing" | "ready" | "error";

export type WalletKind = "embedded" | "external" | null;

export type WalletState = Readonly<{
  status: WalletRuntimeStatus;
  authenticated: boolean;
  address: string | null;
  walletKind: WalletKind;
  networkName: string;
  chainId: number | null;
  targetChainId: number;
  isTargetChain: boolean;
  explorerUrl: string | null;
  error: string | null;
  busyAction: "create" | "logout" | "switch" | "export" | null;
  login: () => void;
  connectWallet: () => void;
  createWallet: () => Promise<void>;
  logout: () => Promise<void>;
  switchNetwork: () => Promise<void>;
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
  explorerUrl: null,
  error: null,
  busyAction: null,
  login: () => undefined,
  connectWallet: () => undefined,
  createWallet: unavailable,
  logout: unavailable,
  switchNetwork: unavailable,
  exportWallet: unavailable,
  copyAddress: unavailable,
};

export const WalletContext = createContext<WalletState>(defaultWalletState);

export function useWalletState(): WalletState {
  return useContext(WalletContext);
}
