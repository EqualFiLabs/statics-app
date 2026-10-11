import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ActivityPage } from "@/components/dollar/ActivityPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.activity");
  return { title: t("title"), description: t("description") };
}

export default function StaticsActivityPage() {
  return <ActivityPage />;
}
