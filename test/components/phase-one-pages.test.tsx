import { render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/phase-one/PhaseOneLiquidityPanel", () => ({
  PhaseOneLiquidityPanel: () => <div>Phase 1 liquidity plumbing</div>,
}));
vi.mock("@/components/phase-one/PhaseOnePositionsPanel", () => ({
  PhaseOnePositionsPanel: () => <div>Phase 1 position plumbing</div>,
}));
vi.mock("@/components/phase-one/PhaseOneMaintenancePanel", () => ({
  PhaseOneMaintenancePanel: () => <div>Phase 1 maintenance plumbing</div>,
}));

import { LiquidityPage } from "@/components/liquidity/LiquidityPage";
import { PositionListPage } from "@/components/positions/PositionListPage";
import { RewardsPage } from "@/components/rewards/RewardsPage";
import type { DeploymentOption, PhaseOneDeployment } from "@/lib/deployments/types";
import { DeploymentContext } from "@/providers/deployment-context";

const phaseOne = {
  kind: "phase-one",
  descriptor: {
    deploymentId: "phase-one-fixture",
    label: "Phase 1",
    network: "Fixture",
    chainId: 4_663,
    stage: "phase-one",
    capabilities: ["public-lp-positions", "position-staking", "public-maintenance"],
    available: true,
  },
  supportedPools: [],
} as unknown as PhaseOneDeployment;
const option = {
  networkId: "robinhood",
  descriptor: phaseOne.descriptor,
  launch: null,
  phaseOne,
  protocol: null,
} satisfies DeploymentOption;

function withPhaseOne(ui: React.ReactElement) {
  return render(
    <DeploymentContext.Provider
      value={{ active: option, options: [option], selectNetwork: vi.fn() }}
    >
      {ui}
    </DeploymentContext.Provider>
  );
}

describe("Phase 1 product routes", () => {
  it("routes liquidity to public pool management", () => {
    withPhaseOne(<LiquidityPage />);
    expect(screen.getByText("Phase 1 liquidity plumbing")).toBeInTheDocument();
  });

  it("routes positions to PositionNFT staking and gauges", () => {
    withPhaseOne(<PositionListPage />);
    expect(screen.getByText("Phase 1 position plumbing")).toBeInTheDocument();
  });

  it("composes rewards with position state and permissionless maintenance", () => {
    withPhaseOne(<RewardsPage />);
    expect(screen.getByText("Phase 1 position plumbing")).toBeInTheDocument();
    expect(screen.getByText("Phase 1 maintenance plumbing")).toBeInTheDocument();
  });
});
