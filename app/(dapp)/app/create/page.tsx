import type { Metadata } from "next";

import { BasketCreatePreview } from "@/components/preview/RemainingSurfacesPreview";
import { dappPreviewEnabled } from "@/lib/dapp-preview";

export const metadata: Metadata = {
  title: "Create Basket | Statics",
  description: "Review a permissionless Statics basket configuration before creation.",
};

export default function BasketCreateRoute() {
  if (dappPreviewEnabled) return <BasketCreatePreview />;
  return (
    <section className="dollar-unavailable">
      <p className="dapp-section-label">Basket creation not released</p>
      <h2>Permissionless basket creation is not available in this release.</h2>
      <p>This route remains disabled outside the local development design preview.</p>
    </section>
  );
}
