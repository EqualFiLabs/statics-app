import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DollarPage } from "@/components/dollar/DollarPage";
import { readDollarProfile } from "@/lib/dollar/profile-navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.dollar");
  return { title: t("title"), description: t("description") };
}

export default async function StaticsDollarPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string | string[] }>;
}) {
  const profile = readDollarProfile((await searchParams).profile);
  return <DollarPage initialProfile={profile} />;
}
