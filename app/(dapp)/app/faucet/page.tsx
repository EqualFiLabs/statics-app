import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TestnetFaucetCard } from "@/components/wallet/TestnetFaucetCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageMetadata.faucet");
  return { title: t("title"), description: t("description") };
}

export default function StaticsFaucetPage() {
  return <TestnetFaucetCard />;
}
