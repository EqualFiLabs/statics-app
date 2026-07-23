import type { Metadata } from "next";
import { DollarOverview } from "@/components/dollar/DollarPage";

export const metadata: Metadata = {
  title: "DApp",
  description: "Sign into the Statics application and manage your wallet connection.",
};

export default function DAppOverviewPage() {
  return <DollarOverview />;
}
