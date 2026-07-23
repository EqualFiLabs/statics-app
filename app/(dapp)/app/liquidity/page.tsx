import type { Metadata } from "next";

import { LiquidityPreview } from "@/components/preview/RemainingSurfacesPreview";
import { dappPreviewEnabled } from "@/lib/dapp-preview";

export const metadata: Metadata = {
  title: "Liquidity | Statics",
  description: "Review canonical pools, permanent liquidity, and user-owned v4 LP NFTs.",
};

export default function LiquidityRoute() {
  if (dappPreviewEnabled) return <LiquidityPreview />;
  return (
    <section className="dollar-unavailable">
      <p className="dapp-section-label">Liquidity management not released</p>
      <h2>Canonical LP transaction plumbing is not available in this release.</h2>
      <p>This route remains disabled outside the local development design preview.</p>
    </section>
  );
}
