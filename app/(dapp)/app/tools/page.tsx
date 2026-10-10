import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ApprovalToolsPage } from "@/components/tools/ApprovalToolsPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.tools");
  return { title: t("title"), description: t("description") };
}

export default function ToolsPage() {
  return <ApprovalToolsPage />;
}
