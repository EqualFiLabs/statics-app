import type { Metadata } from "next";

import { RewardsPage } from "@/components/rewards/RewardsPage";

export const metadata: Metadata = {
  title: "Rewards | Statics",
  description: "Create staking positions and inspect position-selected Statics rewards.",
};

export default function RewardsRoute() {
  return <RewardsPage />;
}
