import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PositionListPage } from "@/components/positions/PositionListPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.accounts");
  return { title: t("title"), description: t("description") };
}

export default function PositionsRoute() {
  return <PositionListPage />;
}
