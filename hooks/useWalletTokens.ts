"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadWalletTokens,
  mergeWalletTokens,
  saveWalletTokens,
  subscribeWalletTokens,
  type WalletToken,
} from "@/lib/wallet-tokens";
import type { StaticsDeployment } from "@/lib/deployments/types";

export function useWalletTokens(chainId: number, deployment?: StaticsDeployment | null) {
  const deploymentId = deployment?.descriptor.deploymentId ?? "shared";
  const [tokens, setTokens] = useState<WalletToken[]>(() => loadWalletTokens(chainId, deployment));

  useEffect(() => {
    const refresh = () => setTokens(loadWalletTokens(chainId, deployment));
    refresh();
    return subscribeWalletTokens(refresh);
  }, [chainId, deployment, deploymentId]);

  const addTokens = useCallback(
    (nextTokens: readonly WalletToken[]) => {
      const current = loadWalletTokens(chainId, deployment);
      const next = mergeWalletTokens(current, nextTokens);
      if (next.length > current.length) {
        saveWalletTokens(chainId, next, deploymentId);
      }
    },
    [chainId, deployment, deploymentId]
  );

  const addToken = useCallback((token: WalletToken) => addTokens([token]), [addTokens]);

  const removeToken = useCallback(
    (address: string) => {
      const current = loadWalletTokens(chainId, deployment);
      saveWalletTokens(
        chainId,
        current.filter(
          (token) => token.isDefault || token.address.toLowerCase() !== address.toLowerCase()
        ),
        deploymentId
      );
    },
    [chainId, deployment, deploymentId]
  );

  return { tokens, addToken, addTokens, removeToken };
}
