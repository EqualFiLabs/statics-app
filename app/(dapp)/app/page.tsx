import type { Metadata } from "next";
import { DeploymentOverview } from "@/components/overview/DeploymentOverview";

export const metadata: Metadata = {
  title: "DApp",
  description: "Sign into the Statics application and manage your wallet connection.",
};

export default function DAppOverviewPage() {
  return <DeploymentOverview />;
}
