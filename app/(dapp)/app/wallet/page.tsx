import type { Metadata } from "next";

import { WalletPage } from "@/components/wallet/WalletPage";

export const metadata: Metadata = {
  title: "Wallet | Statics Protocol",
  description: "Manage funding assets for Statics Protocol.",
};

export default function StaticsWalletPage() {
  return <WalletPage />;
}
