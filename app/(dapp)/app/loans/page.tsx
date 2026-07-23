import type { Metadata } from "next";

import { LoansPreview } from "@/components/preview/RemainingSurfacesPreview";
import { dappPreviewEnabled } from "@/lib/dapp-preview";

export const metadata: Metadata = {
  title: "Loans | Statics",
  description: "Review PositionNFT loan tranches, maturities, and recovery state.",
};

export default function LoansRoute() {
  if (dappPreviewEnabled) return <LoansPreview />;
  return (
    <section className="dollar-unavailable">
      <p className="dapp-section-label">Loans not released</p>
      <h2>Loan transaction plumbing is not available in this release.</h2>
      <p>This route remains disabled outside the local development design preview.</p>
    </section>
  );
}
