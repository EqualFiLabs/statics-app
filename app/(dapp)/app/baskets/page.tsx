import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BasketListPage } from "@/components/baskets/BasketListPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.baskets");
  return { title: t("title"), description: t("description") };
}

export default function BasketsRoute() {
  return <BasketListPage />;
}
