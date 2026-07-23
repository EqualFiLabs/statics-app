import type { Metadata } from "next";

import { LiquidityPage } from "@/components/liquidity/LiquidityPage";

export const metadata: Metadata = {
  title: "Liquidity | Statics",
  description: "Review canonical pools, permanent liquidity, and user-owned v4 LP NFTs.",
};

export default function LiquidityRoute() {
  return <LiquidityPage />;
}
