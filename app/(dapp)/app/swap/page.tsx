import type { Metadata } from "next";

import { SwapPage } from "@/components/swap/SwapPage";

export const metadata: Metadata = {
  title: "Swap | Statics",
  description: "Swap through the canonical STATICS market or the backed Genesis NFT Vault.",
};

export default function SwapRoute() {
  return <SwapPage />;
}
