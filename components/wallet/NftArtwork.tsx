"use client";

import { Boxes, Droplets, Image as ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { NftArtworkDialog } from "@/components/wallet/NftArtworkDialog";
import { OperatorArtwork } from "@/components/wallet/OperatorArtwork";
import { operatorArtwork, positionArtworkDataUri } from "@/lib/wallet/local-nft-art";
import type { WalletNft } from "@/lib/wallet/nfts";

/**
 * Renders only deterministic Statics artwork.
 *
 * Operators use checked-in renderer output plus a local activation overlay;
 * PositionNFTs use the exact local port of their pure renderer. Arbitrary
 * collection and liquidity artwork deliberately falls back to a typed mark so
 * the browser never fetches an attacker-selected media origin.
 */
export function NftArtwork({
  nft,
  chainId,
  expandable = false,
  defer = false,
  operatorTier,
  size = "sm",
}: {
  nft: WalletNft;
  chainId: number;
  expandable?: boolean;
  /** Defer the local image request until the card enters the viewport. */
  defer?: boolean;
  /** Current activation tier for a known Statics Operator. */
  operatorTier?: number;
  /** "sm" is the 48px corner thumbnail; "lg" fills its container. */
  size?: "sm" | "lg";
}) {
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

  const operator = visible ? operatorArtwork(chainId, nft.contract, nft.tokenId) : null;
  const positionSrc =
    visible && nft.kind === "position" ? positionArtworkDataUri(nft.tokenId) : null;
  const src = operator?.src ?? positionSrc;
  const tier = operatorTier ?? nft.artworkTier ?? 0;
  const sizeClass = size === "lg" ? " is-lg" : "";

  if (src && !failed) {
    const imageClassName = `wallet-nft-art${sizeClass}`;
    const artwork = operator ? (
      <OperatorArtwork
        src={operator.src}
        tier={tier}
        accent={operator.accent}
        imageClassName={imageClassName}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- Generated data URI.
      <img
        className={imageClassName}
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
    if (!expandable) return artwork;
    return (
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
          <NftArtworkDialog
            name={nft.name}
            src={src}
            operator={operator ? { tier, accent: operator.accent } : undefined}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </>
    );
  }

  const Placeholder =
    nft.kind === "position" ? Boxes : nft.kind === "liquidity" ? Droplets : ImageIcon;
  return (
    <span
      ref={defer ? observerRef : undefined}
      className={`wallet-nft-art is-placeholder${sizeClass}`}
      aria-hidden="true"
    >
      <Placeholder size={size === "lg" ? 40 : 20} />
    </span>
  );
}
