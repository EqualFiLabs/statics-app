import type { Metadata } from "next";

import { GenesisPage } from "@/components/genesis/GenesisPage";

export const metadata: Metadata = {
  title: "Genesis | Statics",
  description:
    "View and activate the Statics Genesis NFTs held by your connected wallet, and manage their launch rewards.",
};

export default function GenesisRoute() {
  return <GenesisPage />;
}
