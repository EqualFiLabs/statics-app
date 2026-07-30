import type { Metadata } from "next";

import { ApprovalToolsPage } from "@/components/tools/ApprovalToolsPage";

export const metadata: Metadata = {
  title: "Approval Tools | Statics Protocol",
  description: "Review, enable, and revoke Statics application approvals.",
};

export default function ToolsPage() {
  return <ApprovalToolsPage />;
}
