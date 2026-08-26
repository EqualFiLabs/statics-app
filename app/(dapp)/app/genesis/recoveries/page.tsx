import type { Metadata } from "next";

import { GenesisRecoveriesPage } from "@/components/genesis/GenesisRecoveriesPage";

export const metadata: Metadata = {
  title: "Operator recoveries | Statics",
  description:
    "Discover Operators NFTs whose secured credit has matured and recover them permissionlessly for the caller incentive.",
};

export default function GenesisRecoveriesRoute() {
  return <GenesisRecoveriesPage />;
}
