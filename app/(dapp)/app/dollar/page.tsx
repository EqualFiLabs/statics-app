import type { Metadata } from "next";

import { DollarPage } from "@/components/dollar/DollarPage";
import { readDollarProfile } from "@/lib/dollar/profile-navigation";

export const metadata: Metadata = {
  title: "Dollar",
  description: "Deposit WETH collateral or recombine Statics Dollar and Risk shares.",
};

export default async function StaticsDollarPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string | string[] }>;
}) {
  const profile = readDollarProfile((await searchParams).profile);
  return <DollarPage initialProfile={profile} />;
}
