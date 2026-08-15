"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, Droplets, Image as ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { usePublicClient } from "wagmi";

import { NftArtworkDialog } from "@/components/wallet/NftArtworkDialog";
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
export function NftArtwork({
  nft,
  chainId,
  expandable = false,
}: {
  nft: WalletNft;
  chainId: number;
  expandable?: boolean;
}) {
  const publicClient = usePublicClient({ chainId });
  const t = useTranslations("nftArtwork");
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

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
    const artwork = (
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
    if (!expandable) return artwork;
    return (
      <>
        <button
          className="wallet-nft-art-trigger"
          type="button"
          aria-label={t("viewFullSize", { name: nft.name })}
          onClick={() => setViewerOpen(true)}
        >
          {artwork}
        </button>
        {viewerOpen && (
          <NftArtworkDialog name={nft.name} src={image.data} onClose={() => setViewerOpen(false)} />
        )}
      </>
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
