import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { WalletPage } from "@/components/wallet/WalletPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.wallet");
  return { title: t("title"), description: t("description") };
}

export default function StaticsWalletPage() {
  return <WalletPage />;
}
