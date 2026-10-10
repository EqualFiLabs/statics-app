import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PositionDetailPage } from "@/components/positions/PositionDetailPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.account");
  return { title: t("title"), description: t("description") };
}

export default async function PositionDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <PositionDetailPage positionId={BigInt(id)} />;
}
