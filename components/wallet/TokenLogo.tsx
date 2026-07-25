"use client";

/* eslint-disable @next/next/no-img-element -- Token catalogs use allowlisted remote icon hosts. */

import { useState } from "react";

import { allowedTokenLogoURI } from "@/lib/token-icons";

export function TokenLogo({
  token,
  size = 44,
}: {
  token: { address: string; symbol: string; logoURI?: string };
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const uri = allowedTokenLogoURI(token.logoURI);
  if (uri && !failed) {
    // Catalog icons can be hosted by multiple verified token-list sources.
    return (
      <img
        src={uri}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className="wallet-token-logo"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="wallet-token-logo wallet-token-logo-fallback"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {token.symbol.slice(0, 3).toUpperCase()}
    </span>
  );
}
