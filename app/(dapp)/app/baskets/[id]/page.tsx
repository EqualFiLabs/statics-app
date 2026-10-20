import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BasketDetailPage } from "@/components/baskets/BasketDetailPage";
import {
  readBasketConversionAction,
  readBasketPositionFocus,
} from "@/lib/baskets/conversion-navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.basket");
  return { title: t("title"), description: t("description") };
}

export default async function BasketDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    action?: string | string[];
    positionId?: string | string[];
  }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const query = await searchParams;
  return (
    <BasketDetailPage
      basketId={BigInt(id)}
      initialAction={readBasketConversionAction(query.action)}
      initialPositionId={readBasketPositionFocus(query.positionId)}
    />
  );
}
