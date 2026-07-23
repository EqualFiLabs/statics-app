import type { Metadata } from "next";

import { DollarPage } from "@/components/dollar/DollarPage";

export const metadata: Metadata = {
  title: "Dollar",
  description: "Deposit WETH collateral or recombine Statics Dollar and Risk shares.",
};

export default function StaticsDollarPage() {
  return <DollarPage />;
}
