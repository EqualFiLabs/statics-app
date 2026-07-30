import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BasketDetailPage } from "@/components/baskets/BasketDetailPage";
import {
  readBasketConversionAction,
  readBasketPositionFocus,
} from "@/lib/baskets/conversion-navigation";

export const metadata: Metadata = {
  title: "Basket details | Statics",
  description: "Inspect, mint, and redeem a current Statics basket.",
};

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
