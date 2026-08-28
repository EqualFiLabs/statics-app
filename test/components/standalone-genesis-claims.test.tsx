import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import { decodeFunctionData, getAddress, zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { genesisLaunchDistributorAbi } from "@statics-protocol/sdk";
import { StandaloneGenesisPage } from "@/components/genesis/StandaloneGenesisPage";
import type { DeploymentOption, LaunchDeployment } from "@/lib/deployments/types";
import { DeploymentContext } from "@/providers/deployment-context";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  loadOwnedGenesis: vi.fn(),
  readContract: vi.fn(),
}));

vi.mock("wagmi", () => ({ usePublicClient: () => ({ readContract: mocks.readContract }) }));
vi.mock("@/lib/deployments/verify-launch", () => ({
  verifyLaunchDeployment: vi.fn().mockResolvedValue(undefined),
  verifyLaunchDeploymentCached: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/protocol/transactions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/protocol/transactions")>(
    "@/lib/protocol/transactions"
  );
  return { ...actual, executeProtocolTransaction: mocks.execute };
});
vi.mock("@/lib/genesis/owned", async () => {
  const actual = await vi.importActual<typeof import("@/lib/genesis/owned")>("@/lib/genesis/owned");
  return { ...actual, loadOwnedGenesis: mocks.loadOwnedGenesis };
});

const statics = getAddress("0x1111111111111111111111111111111111111111");
const weth = getAddress("0x7777777777777777777777777777777777777777");
const wallet = getAddress("0x2222222222222222222222222222222222222222");
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
    launchDistributor: getAddress("0x3333333333333333333333333333333333333333"),
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

function ownedPortfolio(ownerStatics = 0n, ownerWeth = 0n) {
  return {
    items: Array.from({ length: 65 }, (_, index) => ({
      id: BigInt(index + 1),
      tier: 0,
      multiplierBps: 10_000,
      registered: true,
      rewardWeight: 10_000n,
      pendingStatics: 1n,
      pendingWeth: 0n,
      creditActive: false,
      creditPrincipal: 0n,
      creditMaturity: 0,
    })),
    tierCosts: [0n, 0n, 0n, 0n, 0n],
    rewardShareBps: 5_000,
    totalWeight: 650_000n,
    ownerStatics,
    ownerWeth,
    indexedBlock: 1n,
    chainHead: 1n,
    stale: false,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DeploymentContext.Provider
        value={{ active: option, options: [option], selectNetwork: vi.fn() }}
      >
        <WalletContext.Provider
          value={{
            ...defaultWalletState,
            status: "ready",
            authenticated: true,
            address: wallet,
            chainId: descriptor.chainId,
            isTargetChain: true,
          }}
        >
          <StandaloneGenesisPage deployment={deployment} />
        </WalletContext.Provider>
      </DeploymentContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mocks.execute.mockReset().mockResolvedValue("0xabc");
  mocks.readContract
    .mockReset()
    .mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === "vaultAccounting") {
        return {
          vaultPrice: 0n,
          maximumSupply: 5_555n,
          mintedSupply: 65n,
          vaultInventory: 5_490n,
          circulatingGenesis: 65n,
          tokenBacking: 0n,
          grossBacking: 0n,
          outstandingGenesisCredit: 0n,
          requiredBacking: 0n,
          tokenCustody: 0n,
          reserveETH: 0n,
          nativeCustody: 0n,
          genesisEpochEnd: 0n,
          epochActive: true,
          reserveBackingPerGenesis: 0n,
        };
      }
      throw new Error(`Unexpected read ${functionName}`);
    });
  mocks.loadOwnedGenesis.mockResolvedValue(ownedPortfolio());
});

describe("Standalone Genesis batch claims", () => {
  it("splits 65 Operators and appends the previous-owner claim", async () => {
    mocks.loadOwnedGenesis.mockResolvedValueOnce(ownedPortfolio(1n, 2n));
    renderPage();

    const claimAll = await screen.findByRole("button", { name: "Claim all · 3 transactions" });
    fireEvent.click(claimAll);

    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(3));
    const calls = mocks.execute.mock.calls.map(([request]) => request as { data: `0x${string}` });
    const first = decodeFunctionData({ abi: genesisLaunchDistributorAbi, data: calls[0].data });
    const second = decodeFunctionData({ abi: genesisLaunchDistributorAbi, data: calls[1].data });
    const third = decodeFunctionData({ abi: genesisLaunchDistributorAbi, data: calls[2].data });

    expect(first).toMatchObject({ functionName: "claimAllGenesisRewards" });
    expect(second).toMatchObject({ functionName: "claimAllGenesisRewards" });
    expect(third).toEqual({
      functionName: "claimAllGenesisTreasuryRewards",
      args: [wallet],
    });
    expect(first.args?.[0]).toHaveLength(64);
    expect(second.args?.[0]).toEqual([65n]);
    expect(first.args?.[1]).toBe(wallet);
    expect(second.args?.[1]).toBe(wallet);
  });

  it("stops after a failed batch and surfaces the error", async () => {
    mocks.execute
      .mockResolvedValueOnce("0xabc")
      .mockRejectedValueOnce(new Error("second batch failed"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Claim all · 2 transactions" }));

    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toHaveTextContent("second batch failed");
  });
});
