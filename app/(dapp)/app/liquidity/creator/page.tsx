import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CreatorPoolsPage } from "@/components/liquidity/CreatorPools";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.liquidityCreator");
  return { title: t("title"), description: t("description") };
}

export default function LiquidityCreatorRoute() {
  return <CreatorPoolsPage />;
}
