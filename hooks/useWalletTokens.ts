"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadWalletTokens,
  mergeWalletTokens,
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

  const addTokens = useCallback(
    (nextTokens: readonly WalletToken[]) => {
      const current = loadWalletTokens(chainId);
      const next = mergeWalletTokens(current, nextTokens);
      if (next.length > current.length) {
        saveWalletTokens(chainId, next);
      }
    },
    [chainId]
  );

  const addToken = useCallback((token: WalletToken) => addTokens([token]), [addTokens]);

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

  return { tokens, addToken, addTokens, removeToken };
}
