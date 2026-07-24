"use client";

import { createContext, useContext } from "react";
import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";

export type SolanaWalletState = Readonly<{
  configured: boolean;
  ready: boolean;
  wallets: ConnectedStandardSolanaWallet[];
  createWallet: () => Promise<unknown>;
  signTransaction: (input: {
    wallet: ConnectedStandardSolanaWallet;
    chain: string;
    transaction: Uint8Array;
  }) => Promise<{ signedTransaction: Uint8Array }>;
}>;

const unavailable = async () => {
  throw new Error("Solana wallet support is not configured.");
};

export const defaultSolanaWalletState: SolanaWalletState = {
  configured: false,
  ready: true,
  wallets: [],
  createWallet: unavailable,
  signTransaction: unavailable,
};

export const SolanaWalletContext = createContext<SolanaWalletState>(defaultSolanaWalletState);

export function useSolanaWalletState() {
  return useContext(SolanaWalletContext);
}
