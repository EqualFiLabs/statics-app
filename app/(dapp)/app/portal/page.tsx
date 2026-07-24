import type { Metadata } from "next";

import { PortalWorkspace } from "@/components/portal/PortalWorkspace";

export const metadata: Metadata = {
  title: "Portal | Statics Protocol",
  description: "Swap, bridge, and enter Statics Dollar.",
};

export default function StaticsPortalPage() {
  return <PortalWorkspace />;
}
