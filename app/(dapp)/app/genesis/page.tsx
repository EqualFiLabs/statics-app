import type { Metadata } from "next";

import { GenesisPage } from "@/components/genesis/GenesisPage";

export const metadata: Metadata = {
  title: "Genesis NFT | Statics",
  description:
    "Activate a Statics Genesis NFT and link it to one PositionNFT for increased reward weight.",
};

export default function GenesisRoute() {
  return <GenesisPage />;
}
