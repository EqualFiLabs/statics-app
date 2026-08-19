import type { Metadata } from "next";

import { GenesisPage } from "@/components/genesis/GenesisPage";

export const metadata: Metadata = {
  title: "Genesis NFT | Statics",
  description: "View and activate the Statics Genesis NFTs held by your connected wallet.",
};

export default function GenesisRoute() {
  return <GenesisPage />;
}
