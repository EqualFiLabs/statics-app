import { fireEvent, render, screen } from "@/test/render";
import { getAddress, zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ walletTokenChains: [] as number[] }));

vi.mock("@/hooks/useWalletTokens", () => ({
  useWalletTokens: (chainId: number) => {
    mocks.walletTokenChains.push(chainId);
    return { tokens: [] };
  },
}));

import { EvmSwapPanel } from "@/components/portal/EvmSwapPanel";
import type { DeploymentOption, LaunchDeployment } from "@/lib/deployments/types";
import { DeploymentContext } from "@/providers/deployment-context";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

const walletAddress = getAddress("0x2222222222222222222222222222222222222222");
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
    statics: getAddress("0x1111111111111111111111111111111111111111"),
    weth: getAddress("0x7777777777777777777777777777777777777777"),
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
      currency0: getAddress("0x1111111111111111111111111111111111111111"),
      currency1: getAddress("0x7777777777777777777777777777777777777777"),
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

function renderCanonicalTrade(chainId: number) {
  const switchNetwork = vi.fn().mockResolvedValue(undefined);
  const selectFundingNetwork = vi.fn().mockResolvedValue(undefined);
  render(
    <DeploymentContext.Provider
      value={{ active: option, options: [option], selectNetwork: vi.fn() }}
    >
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "ready",
          authenticated: true,
          address: walletAddress,
          chainId,
          targetChainId: descriptor.chainId,
          isTargetChain: chainId === descriptor.chainId,
          fundingChainId: 42_161,
          fundingNetworkName: "Arbitrum",
          fundingWalletOnSelectedChain: chainId === 42_161,
          switchNetwork,
          selectFundingNetwork,
          getEthereumProvider: async () => null,
        }}
      >
        <EvmSwapPanel canonicalOnly />
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
  return { switchNetwork, selectFundingNetwork };
}

beforeEach(() => {
  mocks.walletTokenChains.length = 0;
});

describe("canonical Trade network", () => {
  it("ignores a remembered Arbitrum funding selection on Robinhood", async () => {
    renderCanonicalTrade(descriptor.chainId);

    expect(await screen.findByRole("button", { name: "Review swap" })).toBeDisabled();
    expect(screen.queryByText(/Arbitrum/)).not.toBeInTheDocument();
    expect(mocks.walletTokenChains).toContain(descriptor.chainId);
    expect(mocks.walletTokenChains).not.toContain(42_161);
  });

  it("switches an off-chain wallet to Robinhood instead of the remembered funding chain", async () => {
    const { switchNetwork, selectFundingNetwork } = renderCanonicalTrade(42_161);

    fireEvent.click(await screen.findByRole("button", { name: "Switch to Robinhood Chain" }));
    expect(switchNetwork).toHaveBeenCalledTimes(1);
    expect(selectFundingNetwork).not.toHaveBeenCalled();
  });
});
