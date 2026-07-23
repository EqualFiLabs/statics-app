import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BasketDetailPage } from "@/components/baskets/BasketDetailPage";

export const metadata: Metadata = {
  title: "Basket details | Statics",
  description: "Inspect, mint, and redeem a current Statics basket.",
};

export default async function BasketDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <BasketDetailPage basketId={BigInt(id)} />;
}
