"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, Droplets, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { usePublicClient } from "wagmi";

import { resolveNftImage } from "@/lib/wallet/nft-image";
import type { WalletNft } from "@/lib/wallet/nfts";

/**
 * The artwork in the corner of an NFT card.
 *
 * Resolves per card rather than in the list query, so a slow gateway or a
 * collection with no metadata delays nothing else. Statics PositionNFTs expose
 * self-contained artwork, while the placeholder remains the ordinary fallback
 * for collections that do not.
 */
export function NftArtwork({ nft, chainId }: { nft: WalletNft; chainId: number }) {
  const publicClient = usePublicClient({ chainId });
  const [failed, setFailed] = useState(false);

  const image = useQuery({
    queryKey: ["nft-image", chainId, nft.contract, nft.tokenId.toString()],
    enabled: Boolean(publicClient),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: ({ signal }) => {
      if (!publicClient) return null;
      return resolveNftImage(publicClient, nft.contract, nft.tokenId, signal);
    },
  });

  if (image.data && !failed) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element --
         Arbitrary remote hosts: next/image would need every collection's
         domain allow-listed up front, which is impossible for user-added
         contracts. */
      <img
        className="wallet-nft-art"
        src={image.data}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  const Placeholder =
    nft.kind === "position" ? Boxes : nft.kind === "liquidity" ? Droplets : ImageIcon;

  return (
    <span className="wallet-nft-art is-placeholder" aria-hidden="true">
      <Placeholder size={20} />
    </span>
  );
}
