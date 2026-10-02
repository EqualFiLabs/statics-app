import { render, screen, waitFor } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DappRouteGuard } from "@/components/app-shell/DappRouteGuard";
import type { DeploymentOption } from "@/lib/deployments/types";
import { DeploymentContext } from "@/providers/deployment-context";

const replace = vi.fn();
let pathname = "/app";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));

const launchDescriptor = {
  deploymentId: "launch",
  label: "Operators launch",
  network: "Robinhood Chain",
  chainId: 4_663,
  stage: "launch",
  capabilities: [
    "overview",
    "canonical-statics-market",
    "genesis-vault",
    "wallet",
    "activity",
    "approval-tools",
  ],
  available: true,
} as const;

const fullDescriptor = {
  ...launchDescriptor,
  deploymentId: "full",
  stage: "full-protocol",
  capabilities: [...launchDescriptor.capabilities, "positions"],
} as const;

const phaseOneDescriptor = {
  ...launchDescriptor,
  deploymentId: "phase-one",
  stage: "phase-one",
  capabilities: [...launchDescriptor.capabilities, "position-staking"],
} as const;

function option(
  descriptor: typeof launchDescriptor | typeof fullDescriptor | typeof phaseOneDescriptor
): DeploymentOption {
  return {
    networkId: "robinhood",
    descriptor,
    launch: null,
    protocol: null,
  };
}

function renderGuard(
  descriptor: typeof launchDescriptor | typeof fullDescriptor | typeof phaseOneDescriptor
) {
  const active = option(descriptor);
  return render(
    <DeploymentContext.Provider value={{ active, options: [active], selectNetwork: vi.fn() }}>
      <DappRouteGuard>Route content</DappRouteGuard>
    </DeploymentContext.Provider>
  );
}

describe("DappRouteGuard", () => {
  beforeEach(() => {
    pathname = "/app";
    replace.mockReset();
  });

  it.each(["/app/positions", "/app/positions/1042"])(
    "redirects unsupported launch route %s without rendering its content",
    async (route) => {
      pathname = route;
      renderGuard(launchDescriptor);

      expect(screen.queryByText("Route content")).not.toBeInTheDocument();
      expect(screen.getByText("Loading the application…")).toBeInTheDocument();
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
    }
  );

  it.each(["/app/wallet", "/app/activity", "/app/tools"])(
    "keeps allowed launch route %s",
    (route) => {
      pathname = route;
      renderGuard(launchDescriptor);
      expect(screen.getByText("Route content")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    }
  );

  it("leaves full-protocol Positions untouched", () => {
    pathname = "/app/positions";
    renderGuard(fullDescriptor);
    expect(screen.getByText("Route content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("allows the Phase 1 position dashboard but rejects legacy position details", async () => {
    pathname = "/app/positions";
    const rendered = renderGuard(phaseOneDescriptor);
    expect(screen.getByText("Route content")).toBeInTheDocument();
    rendered.unmount();

    pathname = "/app/positions/1042";
    renderGuard(phaseOneDescriptor);
    expect(screen.queryByText("Route content")).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
  });

  it("leaves unknown routes to Next.js instead of treating them as Overview", () => {
    pathname = "/app/unknown";
    renderGuard(launchDescriptor);
    expect(screen.getByText("Route content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
