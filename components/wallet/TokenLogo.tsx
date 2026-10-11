"use client";

/* eslint-disable @next/next/no-img-element -- Token catalogs resolve to generated local assets. */

import { useState } from "react";

import { allowedTokenLogoURI, chainTokenLogoURI } from "@/lib/token-icons";

/** Palette size in app/globals.css (`--token-badge-0` …). */
const BADGE_TONES = 12;

/** A stable colour per token: FNV-1a over the lower-cased address, so it never changes. */
export function tokenBadgeTone(address: string): number {
  let hash = 0x811c9dc5;
  for (const char of address.toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % BADGE_TONES;
}

export function TokenLogo({
  token,
  size = 44,
  chainId,
}: {
  token: { address: string; symbol: string; logoURI?: string };
  size?: number;
  /** Lets tokens without a list logo use a reviewed per-chain logo. */
  chainId?: number;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const uri =
    allowedTokenLogoURI(token.logoURI) ??
    (chainId === undefined ? null : allowedTokenLogoURI(chainTokenLogoURI(chainId, token.address)));
  if (uri && uri !== failedUri) {
    // Remote catalog sources are normalized into checked-in local WebP files.
    return (
      <img
        src={uri}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailedUri(uri)}
        className="wallet-token-logo"
        style={{ width: size, height: size }}
      />
    );
  }
  // Same box as a logo, with the first letter scaled to it.
  return (
    <span
      className="wallet-token-logo wallet-token-logo-fallback"
      data-tone={tokenBadgeTone(token.address)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {token.symbol.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
