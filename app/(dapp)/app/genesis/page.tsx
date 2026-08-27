import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GenesisPage } from "@/components/genesis/GenesisPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.operators");
  return { title: t("title"), description: t("description") };
}

export default function GenesisRoute() {
  return <GenesisPage />;
}
