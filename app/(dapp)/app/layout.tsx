import { readPublicDeploymentSnapshot } from "@/lib/server/deployment-manifests";
import { AppShell } from "@/components/app-shell/AppShell";
import { DappRouteGuard } from "@/components/app-shell/DappRouteGuard";
import { DAppProviders } from "@/providers/DAppProviders";

import "./app.css";
import "./shell-layout.css";
import "./visual-direction.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function DAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DAppProviders deploymentSnapshot={readPublicDeploymentSnapshot()}>
      <DappRouteGuard>
        <AppShell>{children}</AppShell>
      </DappRouteGuard>
    </DAppProviders>
  );
}
