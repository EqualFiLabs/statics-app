import type { Metadata } from "next";

import { TestnetFaucetCard } from "@/components/wallet/TestnetFaucetCard";

export const metadata: Metadata = {
  title: "Faucet | Statics Protocol",
  description: "Claim and add Robinhood Chain testnet assets.",
};

export default function StaticsFaucetPage() {
  return <TestnetFaucetCard />;
}
