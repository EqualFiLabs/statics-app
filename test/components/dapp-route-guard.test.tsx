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
  label: "Genesis launch",
  network: "Robinhood Chain",
  chainId: 4_663,
  stage: "launch",
  capabilities: [],
  available: true,
} as const;

const fullDescriptor = {
  ...launchDescriptor,
  deploymentId: "full",
  stage: "full-protocol",
} as const;

function option(descriptor: typeof launchDescriptor | typeof fullDescriptor): DeploymentOption {
  return {
    networkId: "robinhood",
    descriptor,
    launch: null,
    protocol: null,
  };
}

function renderGuard(descriptor: typeof launchDescriptor | typeof fullDescriptor) {
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

  it("leaves unknown routes to Next.js instead of treating them as Overview", () => {
    pathname = "/app/unknown";
    renderGuard(launchDescriptor);
    expect(screen.getByText("Route content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
