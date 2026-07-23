import { AppShell } from "@/components/app-shell/AppShell";
import { DAppProviders } from "@/providers/DAppProviders";

import "./app.css";

export default function DAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DAppProviders>
      <AppShell>{children}</AppShell>
    </DAppProviders>
  );
}
