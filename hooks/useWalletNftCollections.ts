"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadNftCollections,
  saveNftCollections,
  subscribeNftCollections,
  type NftCollection,
} from "@/lib/wallet/nft-contracts";
import type { StaticsDeployment } from "@/lib/deployments/types";

/** Mirrors useWalletTokens, so added NFT collections behave like added tokens. */
export function useWalletNftCollections(
  chainId: number | null,
  deployment?: StaticsDeployment | null
) {
  const deploymentId = deployment?.descriptor.deploymentId ?? "shared";
  const canonicalGenesis = deployment
    ? deployment.kind === "launch"
      ? deployment.contracts.genesis
      : deployment.protocol.genesis?.collection
    : undefined;
  const [collections, setCollections] = useState<NftCollection[]>(() =>
    chainId === null ? [] : loadNftCollections(chainId, deployment)
  );

  useEffect(() => {
    const refresh = () =>
      setCollections(chainId === null ? [] : loadNftCollections(chainId, deployment));
    refresh();
    if (chainId === null) return;
    return subscribeNftCollections(refresh);
  }, [chainId, deployment, deploymentId]);

  const addCollection = useCallback(
    (collection: NftCollection) => {
      if (chainId === null) return;
      const current = loadNftCollections(chainId, deployment);
      if (
        current.some(
          (candidate) => candidate.address.toLowerCase() === collection.address.toLowerCase()
        )
      ) {
        return;
      }
      saveNftCollections(
        chainId,
        [
          ...current.filter(
            (candidate) =>
              !canonicalGenesis ||
              candidate.address.toLowerCase() !== canonicalGenesis.toLowerCase()
          ),
          collection,
        ],
        deploymentId
      );
    },
    [canonicalGenesis, chainId, deployment, deploymentId]
  );

  const removeCollection = useCallback(
    (address: string) => {
      if (chainId === null) return;
      if (canonicalGenesis?.toLowerCase() === address.toLowerCase()) return;
      const current = loadNftCollections(chainId, deployment);
      saveNftCollections(
        chainId,
        current.filter(
          (entry) =>
            entry.address.toLowerCase() !== address.toLowerCase() &&
            (!canonicalGenesis || entry.address.toLowerCase() !== canonicalGenesis.toLowerCase())
        ),
        deploymentId
      );
    },
    [canonicalGenesis, chainId, deployment, deploymentId]
  );

  return { collections, addCollection, removeCollection };
}
