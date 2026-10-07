import type { Metadata } from "next";
import { isHash } from "viem";

import { readRewardPositionFocus } from "@/lib/rewards/navigation";
import { LiquidityPage } from "@/components/liquidity/LiquidityPage";

export const metadata: Metadata = {
  title: "Liquidity | Statics",
  description: "Review canonical pools, permanent liquidity, and user-owned v4 LP NFTs.",
};

export default async function LiquidityRoute({
  searchParams,
}: {
  searchParams: Promise<{ positionId?: string | string[]; poolId?: string | string[] }>;
}) {
  const search = await searchParams;
  return (
    <LiquidityPage
      initialPositionId={readRewardPositionFocus(search.positionId)}
      initialPoolId={
        typeof search.poolId === "string" && isHash(search.poolId) ? search.poolId : null
      }
    />
  );
}
