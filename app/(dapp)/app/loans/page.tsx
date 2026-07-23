import type { Metadata } from "next";

import { LoansPage } from "@/components/loans/LoansPage";

export const metadata: Metadata = {
  title: "Loans | Statics",
  description: "Review PositionNFT loan tranches, maturities, and recovery state.",
};

export default function LoansRoute() {
  return <LoansPage />;
}
