import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LoansPage } from "@/components/loans/LoansPage";
import { readBorrowDestination } from "@/lib/loans/loans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.loans");
  return { title: t("title"), description: t("description") };
}

export default async function LoansRoute({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string | string[] }>;
}) {
  return (
    <LoansPage initialBorrowDestination={readBorrowDestination((await searchParams).destination)} />
  );
}
