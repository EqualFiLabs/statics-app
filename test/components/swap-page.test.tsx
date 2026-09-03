import { fireEvent, render, renderWithLocale, screen } from "@/test/render";
import { getAddress, zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";

const searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));
import { SwapPage } from "@/components/swap/SwapPage";
import type { DeploymentOption, LaunchDeployment } from "@/lib/deployments/types";
import { DeploymentContext } from "@/providers/deployment-context";
import spanish from "@/messages/es.json";

vi.mock("@/components/portal/EvmSwapPanel", () => ({
  EvmSwapPanel: ({ canonicalOnly }: { canonicalOnly?: boolean }) => (
    <div>Token swap {canonicalOnly ? "canonical" : "general"}</div>
  ),
}));
vi.mock("@/components/genesis/GenesisVaultSwapPanel", () => ({
  GenesisVaultSwapPanel: () => <div>Next available Operator NFT</div>,
}));
vi.mock("@/components/swap/TradeMarketStats", () => ({
  TradeMarketStats: () => <div>Market statistics</div>,
}));

const statics = getAddress("0x1111111111111111111111111111111111111111");
const weth = getAddress("0x7777777777777777777777777777777777777777");
const descriptor = {
  deploymentId: "launch-fixture",
  label: "Statics Operators",
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
const option = {
  networkId: "robinhood",
  descriptor,
  launch: deployment,
  protocol: null,
} satisfies DeploymentOption;

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
    fireEvent.click(screen.getByRole("tab", { name: "Operator NFT" }));
    expect(screen.getByText("Next available Operator NFT")).toBeInTheDocument();
    expect(screen.queryByText("Token swap canonical")).not.toBeInTheDocument();
  });

  it("starts in NFT mode for the explicit mode query", () => {
    searchParams.set("mode", "nft");
    render(
      <DeploymentContext.Provider
        value={{ active: option, options: [option], selectNetwork: vi.fn() }}
      >
        <SwapPage />
      </DeploymentContext.Provider>
    );

    expect(screen.getByText("Next available Operator NFT")).toBeInTheDocument();
    expect(screen.queryByText("Token swap canonical")).not.toBeInTheDocument();
    searchParams.delete("mode");
  });

  it("renders the Genesis trade controls in Spanish", () => {
    renderWithLocale(
      <DeploymentContext.Provider
        value={{ active: option, options: [option], selectNetwork: vi.fn() }}
      >
        <SwapPage />
      </DeploymentContext.Provider>,
      "es",
      spanish
    );

    expect(screen.getByRole("tablist", { name: "Tipo de intercambio" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Token" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "NFT de Operator" })).toBeInTheDocument();
  });
});
