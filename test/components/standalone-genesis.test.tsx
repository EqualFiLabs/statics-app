import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@/test/render";
import { getAddress, zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";

import { GenesisPage } from "@/components/genesis/GenesisPage";
import type { DeploymentOption, LaunchDeployment } from "@/lib/deployments/types";
import { DeploymentContext } from "@/providers/deployment-context";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

vi.mock("wagmi", () => ({ usePublicClient: () => null }));

const statics = getAddress("0x1111111111111111111111111111111111111111");
const weth = getAddress("0x7777777777777777777777777777777777777777");
const descriptor = {
  deploymentId: "launch-fixture",
  label: "Statics Genesis",
  network: "Robinhood Chain",
  chainId: 4_663,
  stage: "launch",
  capabilities: ["overview", "genesis-vault"],
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

describe("standalone Genesis surface", () => {
  it("separates Vault inventory, owned NFTs, and launch rewards", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <DeploymentContext.Provider
          value={{ active: option, options: [option], selectDeployment: vi.fn() }}
        >
          <WalletContext.Provider value={{ ...defaultWalletState, status: "signed-out" }}>
            <GenesisPage />
          </WalletContext.Provider>
        </DeploymentContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("button", { name: "Explore the Vault" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "My Genesis NFTs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch rewards" })).toBeInTheDocument();
    expect(screen.getByText("Fixed backing")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "My Genesis NFTs" }));
    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
  });
});
