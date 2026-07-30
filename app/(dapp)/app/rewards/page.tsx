import type { Metadata } from "next";

import { RewardsPage } from "@/components/rewards/RewardsPage";
import { readRewardPositionFocus } from "@/lib/rewards/navigation";

export const metadata: Metadata = {
  title: "Rewards | Statics",
  description: "Create staking positions and inspect position-selected Statics rewards.",
};

export default async function RewardsRoute({
  searchParams,
}: {
  searchParams: Promise<{ positionId?: string | string[] }>;
}) {
  const positionId = readRewardPositionFocus((await searchParams).positionId);
  return <RewardsPage initialPositionId={positionId} />;
}
