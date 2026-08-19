import { fireEvent, render, screen } from "@/test/render";
import { getAddress, zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";

import { SwapPage } from "@/components/swap/SwapPage";
import type { DeploymentOption, LaunchDeployment } from "@/lib/deployments/types";
import { DeploymentContext } from "@/providers/deployment-context";

vi.mock("@/components/portal/EvmSwapPanel", () => ({
  EvmSwapPanel: ({ canonicalOnly }: { canonicalOnly?: boolean }) => (
    <div>Token swap {canonicalOnly ? "canonical" : "general"}</div>
  ),
}));
vi.mock("@/components/genesis/GenesisVaultSwapPanel", () => ({
  GenesisVaultSwapPanel: () => <div>Next available Genesis NFT</div>,
}));

const statics = getAddress("0x1111111111111111111111111111111111111111");
const weth = getAddress("0x7777777777777777777777777777777777777777");
const descriptor = {
  deploymentId: "launch-fixture",
  label: "Statics Genesis",
  network: "Robinhood Chain",
  chainId: 4_663,
  stage: "launch",
  capabilities: ["overview", "canonical-statics-market", "genesis-vault"],
  available: true,
} as const;
const deployment = {
  kind: "launch",
  descriptor,
  deploymentStartBlock: 1n,
  protocolCommit: "fixture",
  source: "development-fixture",
  contracts: {
    statics,
    weth,
    genesis: zeroAddress,
    vault: zeroAddress,
    activationRegistry: zeroAddress,
    feeReceiver: zeroAddress,
    launchDistributor: zeroAddress,
    poolManager: zeroAddress,
    stateView: zeroAddress,
    quoter: zeroAddress,
    universalRouter: zeroAddress,
    permit2: zeroAddress,
  },
  runtimeCodeHashes: {},
  market: {
    poolId: `0x${"1".repeat(64)}`,
    poolKey: {
      currency0: statics,
      currency1: weth,
      fee: 10_000,
      tickSpacing: 8,
      hooks: zeroAddress,
    },
  },
} as const satisfies LaunchDeployment;
const option = { descriptor, deployment } satisfies DeploymentOption;

describe("Swap page", () => {
  it("reuses canonical token swapping and switches to the Genesis Vault", () => {
    render(
      <DeploymentContext.Provider
        value={{ active: option, options: [option], selectNetwork: vi.fn() }}
      >
        <SwapPage />
      </DeploymentContext.Provider>
    );

    expect(screen.getByText("Token swap canonical")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "NFT" }));
    expect(screen.getByText("Next available Genesis NFT")).toBeInTheDocument();
    expect(screen.queryByText("Token swap canonical")).not.toBeInTheDocument();
  });
});
