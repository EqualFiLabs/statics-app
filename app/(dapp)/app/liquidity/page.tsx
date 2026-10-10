import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isHash } from "viem";

import { readRewardPositionFocus } from "@/lib/rewards/navigation";
import { LiquidityPage } from "@/components/liquidity/LiquidityPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.liquidity");
  return { title: t("title"), description: t("description") };
}

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
