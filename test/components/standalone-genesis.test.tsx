import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@/test/render";
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
  label: "Statics Operators",
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
const option = {
  networkId: "robinhood",
  descriptor,
  launch: deployment,
  protocol: null,
} satisfies DeploymentOption;

describe("standalone Genesis surface", () => {
  it("keeps the Genesis management page focused on owned NFTs", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <DeploymentContext.Provider
          value={{ active: option, options: [option], selectNetwork: vi.fn() }}
        >
          <WalletContext.Provider value={{ ...defaultWalletState, status: "signed-out" }}>
            <GenesisPage />
          </WalletContext.Provider>
        </DeploymentContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
    expect(screen.queryByText("Explore the Vault")).not.toBeInTheDocument();
    expect(screen.queryByText("Launch rewards")).not.toBeInTheDocument();
  });
});
