import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RewardsPage } from "@/components/rewards/RewardsPage";
import { readRewardPositionFocus } from "@/lib/rewards/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.earn");
  return { title: t("title"), description: t("description") };
}

export default async function RewardsRoute({
  searchParams,
}: {
  searchParams: Promise<{ positionId?: string | string[] }>;
}) {
  const positionId = readRewardPositionFocus((await searchParams).positionId);
  return <RewardsPage initialPositionId={positionId} />;
}
