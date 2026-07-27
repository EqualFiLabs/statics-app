"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadNftCollections,
  saveNftCollections,
  subscribeNftCollections,
  type NftCollection,
} from "@/lib/wallet/nft-contracts";

/** Mirrors useWalletTokens, so added NFT collections behave like added tokens. */
export function useWalletNftCollections(chainId: number) {
  const [collections, setCollections] = useState<NftCollection[]>(() =>
    loadNftCollections(chainId)
  );

  useEffect(() => {
    const refresh = () => setCollections(loadNftCollections(chainId));
    refresh();
    return subscribeNftCollections(refresh);
  }, [chainId]);

  const addCollection = useCallback(
    (collection: NftCollection) => {
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
