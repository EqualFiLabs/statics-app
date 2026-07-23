import type { Metadata } from "next";

import { WalletSettings } from "@/components/app-shell/WalletSettings";

export const metadata: Metadata = {
  title: "Wallet Settings",
  description: "Manage your Statics wallet connection and local application session.",
};

export default function WalletSettingsPage() {
  return <WalletSettings />;
}
