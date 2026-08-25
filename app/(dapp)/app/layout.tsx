import { AppShell } from "@/components/app-shell/AppShell";
import { DappRouteGuard } from "@/components/app-shell/DappRouteGuard";
import { DAppProviders } from "@/providers/DAppProviders";

import "./app.css";
import "./shell-layout.css";

export default function DAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DAppProviders>
      <DappRouteGuard>
        <AppShell>{children}</AppShell>
      </DappRouteGuard>
    </DAppProviders>
  );
}
