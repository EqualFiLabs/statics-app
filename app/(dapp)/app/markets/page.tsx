import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MarketsOverview } from "@/components/overview/DeploymentOverview";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.markets");
  return { title: t("title"), description: t("description") };
}

export default function MarketsPage() {
  return <MarketsOverview />;
}
