import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PositionDetailPage } from "@/components/positions/PositionDetailPage";

export const metadata: Metadata = {
  title: "Position details | Statics",
  description: "Manage collateral, staking, and reward selections for a Statics PositionNFT.",
};

export default async function PositionDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <PositionDetailPage positionId={BigInt(id)} />;
}
