import type { Metadata } from "next";

import { GenesisRewardsPage } from "@/components/genesis/GenesisRewardsPage";

export const metadata: Metadata = {
  title: "Genesis Rewards | Statics",
  description: "Register Genesis NFTs and claim their share of launch market fees.",
};

export default function GenesisRewardsRoute() {
  return <GenesisRewardsPage />;
}
