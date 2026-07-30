import type { Metadata } from "next";

import { LoansPage } from "@/components/loans/LoansPage";
import { readBorrowDestination } from "@/lib/loans/loans";

export const metadata: Metadata = {
  title: "Loans | Statics",
  description: "Review PositionNFT loan tranches, maturities, and recovery state.",
};

export default async function LoansRoute({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string | string[] }>;
}) {
  return (
    <LoansPage initialBorrowDestination={readBorrowDestination((await searchParams).destination)} />
  );
}
