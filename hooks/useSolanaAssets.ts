"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Connection, PublicKey, type ParsedAccountData } from "@solana/web3.js";

import { useSolanaTokens } from "@/hooks/useSolanaTokens";
import { SOL_MINT } from "@/lib/portal/solana";
import {
  SOLANA_MAINNET_RPC_URL,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@/lib/solana-wallet";
import type { SolanaToken } from "@/lib/solana-tokens";
import { useSolanaWalletState } from "@/providers/solana-context";

export type SolanaAsset = SolanaToken &
  Readonly<{
    balance: bigint | null;
    removable: boolean;
    tokenAccount?: string;
    tokenProgramId?: string;
  }>;

type ParsedToken = {
  mint: string;
  amount: bigint;
  decimals: number;
  tokenAccount: string;
  tokenProgramId: string;
};

function parseTokenAccount(
  entry: Awaited<ReturnType<Connection["getParsedTokenAccountsByOwner"]>>["value"][number]
): ParsedToken | null {
  const data = entry.account.data as ParsedAccountData | Buffer;
  if (!("parsed" in data)) return null;
  const info = data.parsed?.info as
    { mint?: unknown; tokenAmount?: { amount?: unknown; decimals?: unknown } } | undefined;
  if (
    typeof info?.mint !== "string" ||
    typeof info.tokenAmount?.amount !== "string" ||
    !Number.isInteger(info.tokenAmount.decimals)
  ) {
    return null;
  }
  return {
    mint: info.mint,
    amount: BigInt(info.tokenAmount.amount),
    decimals: Number(info.tokenAmount.decimals),
    tokenAccount: entry.pubkey.toBase58(),
    tokenProgramId: entry.account.owner.toBase58(),
  };
}

export function useSolanaAssets() {
  const runtime = useSolanaWalletState();
  const wallet = runtime.wallets[0];
  const managed = useSolanaTokens();
  const [balances, setBalances] = useState<Record<string, ParsedToken | bigint>>({});
  const [detected, setDetected] = useState<ParsedToken[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const refreshId = useRef(0);
  const connection = useMemo(() => new Connection(SOLANA_MAINNET_RPC_URL, "confirmed"), []);

  const refresh = useCallback(async () => {
    const id = ++refreshId.current;
    if (!wallet?.address) return;
    setRefreshing(true);
    try {
      const owner = new PublicKey(wallet.address);
      const [native, legacy, token2022] = await Promise.allSettled([
        connection.getBalance(owner, "confirmed"),
        connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
        connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
      ]);
      if (id !== refreshId.current) return;
      const parsed = [
        ...(legacy.status === "fulfilled" ? legacy.value.value : []),
        ...(token2022.status === "fulfilled" ? token2022.value.value : []),
      ].flatMap((entry) => {
        const token = parseTokenAccount(entry);
        return token ? [token] : [];
      });
      setDetected(parsed.filter((token) => token.amount > 0n));
      setBalances((current) => {
        const next = { ...current };
        if (native.status === "fulfilled") next[SOL_MINT] = BigInt(native.value);
        for (const token of parsed) next[token.mint] = token;
        return next;
      });
    } finally {
      if (id === refreshId.current) setRefreshing(false);
    }
  }, [connection, wallet?.address]);

  useEffect(() => {
    if (!wallet?.address) {
      const timeout = window.setTimeout(() => {
        setBalances({});
        setDetected([]);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh, wallet?.address]);

  const tokens = useMemo(() => {
    const knownMints = new Set(managed.tokens.map((token) => token.mint));
    const discovered: SolanaToken[] = detected
      .filter((token) => !knownMints.has(token.mint))
      .map((token) => ({
        mint: token.mint,
        symbol: "SPL",
        name: "SPL Token",
        decimals: token.decimals,
        tokenProgramId: token.tokenProgramId,
      }));
    return [...managed.tokens, ...discovered];
  }, [detected, managed.tokens]);

  const assets = useMemo<SolanaAsset[]>(() => {
    const removableMints = new Set(
      managed.tokens.filter((token) => !token.isDefault).map((token) => token.mint)
    );
    return tokens.map((token) => {
      const value = balances[token.mint];
      const removable = removableMints.has(token.mint);
      if (typeof value === "bigint") return { ...token, balance: value, removable };
      if (value) {
        return {
          ...token,
          balance: value.amount,
          removable,
          tokenAccount: value.tokenAccount,
          tokenProgramId: value.tokenProgramId,
        };
      }
      return { ...token, balance: null, removable };
    });
  }, [balances, managed.tokens, tokens]);

  return {
    runtime,
    wallet,
    connection,
    assets,
    refreshing,
    refresh,
    addToken: managed.addToken,
    removeToken: managed.removeToken,
  };
}
