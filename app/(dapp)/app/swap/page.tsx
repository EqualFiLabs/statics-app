import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SwapPage } from "@/components/swap/SwapPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.trade");
  return { title: t("title"), description: t("description") };
}

export default function SwapRoute() {
  return <SwapPage />;
}
