import type { Metadata } from "next";

import { PositionListPage } from "@/components/positions/PositionListPage";

export const metadata: Metadata = {
  title: "Position NFT | Statics",
  description: "Discover and manage wallet-owned Statics PositionNFTs.",
};

export default function PositionsRoute() {
  return <PositionListPage />;
}
