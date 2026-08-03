"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadNftCollections,
  saveNftCollections,
  subscribeNftCollections,
  type NftCollection,
} from "@/lib/wallet/nft-contracts";

/** Mirrors useWalletTokens, so added NFT collections behave like added tokens. */
export function useWalletNftCollections(chainId: number | null) {
  const [collections, setCollections] = useState<NftCollection[]>(() =>
    chainId === null ? [] : loadNftCollections(chainId)
  );

  useEffect(() => {
    const refresh = () => setCollections(chainId === null ? [] : loadNftCollections(chainId));
    refresh();
    if (chainId === null) return;
    return subscribeNftCollections(refresh);
  }, [chainId]);

  const addCollection = useCallback(
    (collection: NftCollection) => {
      if (chainId === null) return;
      const current = loadNftCollections(chainId);
      if (
        current.some(
          (candidate) => candidate.address.toLowerCase() === collection.address.toLowerCase()
        )
      ) {
        return;
      }
      saveNftCollections(chainId, [...current, collection]);
    },
    [chainId]
  );

  const removeCollection = useCallback(
    (address: string) => {
      if (chainId === null) return;
      const current = loadNftCollections(chainId);
      saveNftCollections(
        chainId,
        current.filter((entry) => entry.address.toLowerCase() !== address.toLowerCase())
      );
    },
    [chainId]
  );

  return { collections, addCollection, removeCollection };
}
