"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadSolanaTokens,
  saveSolanaTokens,
  subscribeSolanaTokens,
  type SolanaToken,
} from "@/lib/solana-tokens";

export function useSolanaTokens() {
  const [tokens, setTokens] = useState(loadSolanaTokens);
  useEffect(() => {
    const refresh = () => setTokens(loadSolanaTokens());
    refresh();
    return subscribeSolanaTokens(refresh);
  }, []);
  const addToken = useCallback((token: SolanaToken) => {
    const current = loadSolanaTokens();
    if (!current.some((candidate) => candidate.mint === token.mint)) {
      saveSolanaTokens([...current, token]);
    }
  }, []);
  const removeToken = useCallback((mint: string) => {
    saveSolanaTokens(loadSolanaTokens().filter((token) => token.isDefault || token.mint !== mint));
  }, []);
  return { tokens, addToken, removeToken };
}
