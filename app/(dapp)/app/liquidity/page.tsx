import type { Metadata } from "next";

import { readRewardPositionFocus } from "@/lib/rewards/navigation";
import { LiquidityPage } from "@/components/liquidity/LiquidityPage";

export const metadata: Metadata = {
  title: "Liquidity | Statics",
  description: "Review canonical pools, permanent liquidity, and user-owned v4 LP NFTs.",
};

export default async function LiquidityRoute({
  searchParams,
}: {
  searchParams: Promise<{ positionId?: string | string[] }>;
}) {
  return (
    <LiquidityPage initialPositionId={readRewardPositionFocus((await searchParams).positionId)} />
  );
}
