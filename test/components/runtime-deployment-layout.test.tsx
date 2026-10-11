import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  publicDeploymentSnapshot,
  type PublicDeploymentSnapshot,
} from "@/lib/deployments/public-manifests";
import { runtimeManifests } from "@/test/fixtures/public-manifests";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/server/deployment-manifests", () => ({ readPublicDeploymentSnapshot: mocks.read }));
vi.mock("@/providers/DAppProviders", () => ({
  DAppProviders: ({
    children,
    deploymentSnapshot,
  }: {
    children: React.ReactNode;
    deploymentSnapshot: PublicDeploymentSnapshot;
  }) => (
    <div data-testid="snapshot" data-revision={deploymentSnapshot.revision}>
      {children}
    </div>
  ),
}));
vi.mock("@/components/app-shell/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/app-shell/DappRouteGuard", () => ({
  DappRouteGuard: ({ children }: { children: React.ReactNode }) => children,
}));

import DAppLayout, { dynamic, runtime } from "@/app/(dapp)/app/layout";

it("dynamically renders the app with its server-provided runtime snapshot", () => {
  const snapshot = publicDeploymentSnapshot(runtimeManifests(), "runtime-manifest");
  mocks.read.mockReturnValue(snapshot);
  render(<DAppLayout>app</DAppLayout>);
  expect(dynamic).toBe("force-dynamic");
  expect(runtime).toBe("nodejs");
  expect(screen.getByTestId("snapshot")).toHaveAttribute("data-revision", snapshot.revision);
});

it("does not render a transaction provider when configured runtime manifests are unavailable", () => {
  mocks.read.mockImplementation(() => {
    throw new Error("Public deployment configuration is unavailable.");
  });
  expect(() => DAppLayout({ children: "app" })).toThrow(
    "Public deployment configuration is unavailable."
  );
});
