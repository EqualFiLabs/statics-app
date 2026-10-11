import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BasketCreatePage } from "@/components/baskets/BasketCreatePage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.createBasket");
  return { title: t("title"), description: t("description") };
}

export default function BasketCreateRoute() {
  return <BasketCreatePage />;
}
