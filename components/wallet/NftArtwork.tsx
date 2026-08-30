"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, Droplets, Image as ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
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
  defer = false,
  cacheVersion,
  size = "sm",
}: {
  nft: WalletNft;
  chainId: number;
  expandable?: boolean;
  /** Defer the metadata RPC until the card enters the viewport. */
  defer?: boolean;
  /** Optional collection-specific metadata version, such as an activation tier. */
  cacheVersion?: string | number;
  /** "sm" is the 48px corner thumbnail; "lg" fills its container. */
  size?: "sm" | "lg";
}) {
  const publicClient = usePublicClient({ chainId });
  const t = useTranslations("nftArtwork");
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [visible, setVisible] = useState(
    () => !defer || typeof IntersectionObserver === "undefined"
  );
  const observerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!defer || !observerRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" }
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [defer]);

  const image = useQuery({
    queryKey: ["nft-image", chainId, nft.contract, nft.tokenId.toString(), cacheVersion ?? null],
    enabled: Boolean(publicClient && visible),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: ({ signal }) => {
      if (!publicClient) return null;
      return resolveNftImage(publicClient, nft.contract, nft.tokenId, signal);
    },
  });

  const sizeClass = size === "lg" ? " is-lg" : "";

  if (image.data && !failed) {
    const artwork = (
      /* eslint-disable-next-line @next/next/no-img-element --
         Arbitrary remote hosts: next/image would need every collection's
         domain allow-listed up front, which is impossible for user-added
         contracts. */
      <img
        className={`wallet-nft-art${sizeClass}`}
        src={image.data}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
    if (!expandable) return artwork;
    const content = (
      <>
        <button
          className={`wallet-nft-art-trigger${sizeClass}`}
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
    return content;
  }

  const Placeholder =
    nft.kind === "position" ? Boxes : nft.kind === "liquidity" ? Droplets : ImageIcon;

  const placeholder = (
    <span
      ref={defer ? observerRef : undefined}
      className={`wallet-nft-art is-placeholder${sizeClass}`}
      aria-hidden="true"
    >
      <Placeholder size={size === "lg" ? 40 : 20} />
    </span>
  );
  return placeholder;
}
