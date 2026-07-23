import type { Metadata } from "next";

import { ActivityPage } from "@/components/dollar/ActivityPage";

export const metadata: Metadata = {
  title: "Activity",
  description: "Wallet-scoped Statics Dollar transaction activity.",
};

export default function StaticsActivityPage() {
  return <ActivityPage />;
}
