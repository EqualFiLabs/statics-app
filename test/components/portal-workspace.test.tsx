import { render, renderWithLocale, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";
import { PortalWorkspace } from "@/components/portal/PortalWorkspace";
import { DeploymentContext } from "@/providers/deployment-context";
import type { DeploymentOption, DeploymentStage } from "@/lib/deployments/types";
import english from "@/messages/en.json";
import spanish from "@/messages/es.json";
import chinese from "@/messages/zh-CN.json";

const option = (stage: DeploymentStage): DeploymentOption => ({
  networkId: "anvil",
  descriptor: {
    deploymentId: stage,
    label: stage,
    network: "Anvil",
    chainId: 31337,
    stage,
    capabilities: stage === "full-protocol" ? ["wallet", "dollar"] : ["wallet"],
    available: true,
  },
  protocol: null,
  launch: null,
});
const portal = (stage: DeploymentStage) => {
  const active = option(stage);
  return (
    <DeploymentContext.Provider value={{ active, options: [active], selectNetwork: vi.fn() }}>
      <PortalWorkspace />
    </DeploymentContext.Provider>
  );
};

describe("funding Portal", () => {
  it("keeps swaps and bridges in the Portal and routes supported Dollar deployments to their own page", () => {
    render(portal("full-protocol"));
    expect(screen.getByRole("tab", { name: "Swap" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bridge" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Dollar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Dollar →" })).toHaveAttribute(
      "href",
      "/app/dollar?profile=USDG"
    );
  });
  it.each([
    ["en", english],
    ["es", spanish],
    ["zh-CN", chinese],
  ] as const)("omits dead Dollar routes from Phase 1 in %s", (locale, messages) => {
    const { container } = renderWithLocale(portal("phase-one"), locale, messages);
    expect(container.querySelector('a[href^="/app/dollar"]')).toBeNull();
    expect(container.textContent).not.toMatch(/Statics Dollar|USDstx/);
    expect(messages.routes.portal.description).not.toMatch(/Statics Dollar|USDstx/);
    expect(messages.routes.overview.description).not.toMatch(/Dollar|美元余额|saldo en dólares/);
    expect(messages.phaseOne).not.toHaveProperty("unsupported");
  });
  it("removes the Dollar callout when switching to a launch-only deployment", () => {
    const view = render(portal("full-protocol"));
    expect(screen.getByRole("link", { name: "Open Dollar →" })).toBeInTheDocument();
    view.rerender(portal("launch"));
    expect(screen.queryByRole("link", { name: "Open Dollar →" })).not.toBeInTheDocument();
  });
});
