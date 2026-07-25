"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadWalletTokens,
  saveWalletTokens,
  subscribeWalletTokens,
  type WalletToken,
} from "@/lib/wallet-tokens";

export function useWalletTokens(chainId: number) {
  const [tokens, setTokens] = useState<WalletToken[]>(() => loadWalletTokens(chainId));

  useEffect(() => {
    const refresh = () => setTokens(loadWalletTokens(chainId));
    refresh();
    return subscribeWalletTokens(refresh);
  }, [chainId]);

  const addToken = useCallback(
    (token: WalletToken) => {
      const current = loadWalletTokens(chainId);
      if (
        current.some((candidate) => candidate.address.toLowerCase() === token.address.toLowerCase())
      ) {
        return;
      }
      saveWalletTokens(chainId, [...current, token]);
    },
    [chainId]
  );

  const removeToken = useCallback(
    (address: string) => {
      const current = loadWalletTokens(chainId);
      saveWalletTokens(
        chainId,
        current.filter(
          (token) => token.isDefault || token.address.toLowerCase() !== address.toLowerCase()
        )
      );
    },
    [chainId]
  );

  return { tokens, addToken, removeToken };
}
