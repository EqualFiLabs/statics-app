import { AppShell } from "@/components/app-shell/AppShell";

import "./app.css";

export default function DAppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
