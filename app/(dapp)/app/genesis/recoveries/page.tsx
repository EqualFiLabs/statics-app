import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GenesisRecoveriesPage } from "@/components/genesis/GenesisRecoveriesPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.operatorRecoveries");
  return { title: t("title"), description: t("description") };
}

export default function GenesisRecoveriesRoute() {
  return <GenesisRecoveriesPage />;
}
