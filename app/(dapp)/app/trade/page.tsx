import type { Metadata } from "next";

import { TradePage } from "@/components/trade/TradePage";

export const metadata: Metadata = {
  title: "Trade STATICS | Statics",
  description: "Buy or sell STATICS through its canonical Uniswap v4 market.",
};

export default function TradeRoute() {
  return <TradePage />;
}
