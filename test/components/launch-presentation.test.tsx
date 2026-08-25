import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import { getAddress, parseEther, zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenesisCreditPanel } from "@/components/genesis/GenesisCreditPanel";
import { StandaloneGenesisPage } from "@/components/genesis/StandaloneGenesisPage";
import {
  DeploymentOverview,
  formatCanonicalMarketPrice,
} from "@/components/overview/DeploymentOverview";
import type { DeploymentOption, LaunchDeployment } from "@/lib/deployments/types";
import { DeploymentContext } from "@/providers/deployment-context";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

const readContract = vi.fn();
const getBlock = vi.fn();
const loadRecoverableGenesisCredits = vi.fn();

vi.mock("wagmi", () => ({
  usePublicClient: () => ({ readContract, getBlock }),
}));
vi.mock("@/lib/deployments/verify-launch", () => ({
  verifyLaunchDeployment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/indexer/statics", () => ({
  loadRecoverableGenesisCredits: (...args: unknown[]) => loadRecoverableGenesisCredits(...args),
}));
vi.mock("@/lib/genesis/discovery", () => ({
  discoverWalletGenesisIds: (...args: unknown[]) => discoverWalletGenesisIds(...args),
}));
vi.mock("@/lib/wallet/nft-image", () => ({
  resolveNftImage: vi.fn().mockResolvedValue("data:image/svg+xml,%3Csvg/%3E"),
}));
const discoverWalletGenesisIds = vi.fn();

const statics = getAddress("0x1111111111111111111111111111111111111111");
const weth = getAddress("0x7777777777777777777777777777777777777777");
const wallet = getAddress("0x2222222222222222222222222222222222222222");
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
const option = {
  networkId: "robinhood",
  descriptor,
  launch: deployment,
  protocol: null,
} satisfies DeploymentOption;

function vaultAccounting(epochActive: boolean) {
  return {
    vaultPrice: parseEther("180000"),
    maximumSupply: 5_555n,
    mintedSupply: 5_555n,
    vaultInventory: 5_500n,
    circulatingGenesis: 55n,
    tokenBacking: parseEther("9900000"),
    grossBacking: parseEther("9900000"),
    outstandingGenesisCredit: 0n,
    requiredBacking: parseEther("9900000"),
    tokenCustody: parseEther("9900000"),
    reserveETH: parseEther("5"),
    nativeCustody: parseEther("5"),
    genesisEpochEnd: 2_000_000_000n,
    epochActive,
    reserveBackingPerGenesis: parseEther("0.001"),
  };
}

function renderWithProviders(ui: React.ReactNode, signedIn = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DeploymentContext.Provider
        value={{ active: option, options: [option], selectNetwork: vi.fn() }}
      >
        <WalletContext.Provider
          value={{
            ...defaultWalletState,
            status: signedIn ? "ready" : "signed-out",
            authenticated: signedIn,
            address: signedIn ? wallet : null,
            chainId: descriptor.chainId,
            isTargetChain: true,
          }}
        >
          {ui}
        </WalletContext.Provider>
      </DeploymentContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  readContract.mockReset();
  getBlock.mockReset();
  loadRecoverableGenesisCredits.mockReset();
  discoverWalletGenesisIds.mockReset();
});

describe("launch overview", () => {
  it("shows only launch metrics and the three launch actions", async () => {
    readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === "vaultAccounting") return vaultAccounting(true);
      if (functionName === "getSlot0") return [1n << 96n, 0, 0, 0];
      if (functionName === "getLiquidity") return 1n;
      if (functionName === "balanceOf") return parseEther("42");
      throw new Error(`Unexpected read ${functionName}`);
    });

    renderWithProviders(<DeploymentOverview />);

    expect(await screen.findByText(/Active until/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buy STATICS" })).toHaveAttribute("href", "/app/swap");
    expect(screen.getByRole("link", { name: "Acquire Genesis" })).toHaveAttribute(
      "href",
      "/app/swap?mode=nft"
    );
    expect(screen.getByRole("link", { name: "Manage my Genesis" })).toHaveAttribute(
      "href",
      "/app/genesis"
    );
    expect(screen.queryByText("Registered reward weight")).not.toBeInTheDocument();
    expect(screen.queryByText("Fees harvested")).not.toBeInTheDocument();
  });

  it("formats either canonical token ordering without floating-point input", () => {
    expect(formatCanonicalMarketPrice(1n << 96n, statics, statics)).toEqual({
      value: "1",
      unit: "WETH per STATICS",
    });
    expect(formatCanonicalMarketPrice(1n << 96n, weth, statics)).toEqual({
      value: "1",
      unit: "STATICS per WETH",
    });
  });
});

describe("Genesis credit presentation", () => {
  function creditReads(epochActive: boolean, paused: boolean) {
    readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === "vaultAccounting") return vaultAccounting(epochActive);
      if (functionName === "creditOriginationsPaused") return paused;
      if (functionName === "credit") {
        return { owner: zeroAddress, principal: 0n, maturity: 0, recoverableAt: 0, active: false };
      }
      if (functionName === "creditLimit") return parseEther("171000");
      throw new Error(`Unexpected read ${functionName}`);
    });
  }

  it("shows the exact Epoch end and no borrow controls during the Epoch", async () => {
    creditReads(true, false);
    renderWithProviders(<GenesisCreditPanel deployment={deployment} genesisId={1n} />);

    expect(await screen.findByText(/maximum principal is 171000 STATICS/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrow STATICS" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Borrow STATICS")).not.toBeInTheDocument();
  });

  it("shows post-Epoch borrow controls when originations are open", async () => {
    creditReads(false, false);
    renderWithProviders(<GenesisCreditPanel deployment={deployment} genesisId={1n} />);

    expect(await screen.findByRole("button", { name: "Borrow STATICS" })).toBeInTheDocument();
    expect(screen.getByLabelText("Borrow STATICS")).toBeInTheDocument();
  });

  it("shows only pause status when post-Epoch originations are paused", async () => {
    creditReads(false, true);
    renderWithProviders(<GenesisCreditPanel deployment={deployment} genesisId={1n} />);

    expect(
      await screen.findByText("New Genesis credit is temporarily paused.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrow STATICS" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Borrow STATICS")).not.toBeInTheDocument();
  });
});

describe("Genesis recovery navigation", () => {
  it("does not expose Recoveries during the Genesis Epoch", async () => {
    readContract.mockResolvedValue(vaultAccounting(true));
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />, false);

    await waitFor(() => expect(readContract).toHaveBeenCalled());
    expect(screen.queryByRole("tab", { name: "Recoveries" })).not.toBeInTheDocument();
  });

  it("exposes Recoveries after the Genesis Epoch without requiring an owned NFT", async () => {
    readContract.mockResolvedValue(vaultAccounting(false));
    getBlock.mockResolvedValue({ timestamp: 2_100_000_000n });
    loadRecoverableGenesisCredits.mockResolvedValue([]);
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />, false);

    expect(await screen.findByRole("tab", { name: "Recoveries" })).toBeInTheDocument();
  });
});

describe("consolidated Genesis rewards surface", () => {
  function rewardsReads() {
    discoverWalletGenesisIds.mockResolvedValue([1n, 2n]);
    readContract.mockImplementation(
      async ({ functionName, args }: { functionName: string; args: readonly unknown[] }) => {
        if (functionName === "vaultAccounting") return vaultAccounting(true);
        if (functionName === "creditOriginationsPaused") return false;
        if (functionName === "credit") {
          return {
            owner: zeroAddress,
            principal: 0n,
            maturity: 0,
            recoverableAt: 0,
            active: false,
          };
        }
        if (functionName === "creditLimit") return parseEther("171000");
        if (functionName === "tierCost") return parseEther("100");
        if (functionName === "tierOf") return 2;
        if (functionName === "multiplierBps") return 12_500;
        if (functionName === "genesisRewardShareBps") return 1_000n;
        if (functionName === "totalWeight") return 25_000n;
        if (functionName === "ownerClaimable") {
          return args[1] === statics ? parseEther("5") : parseEther("1");
        }
        if (functionName === "registered") return args[0] === 1n;
        if (functionName === "effectiveWeight") return 12_500n;
        if (functionName === "pendingGenesis") {
          return args[1] === statics ? parseEther("2") : parseEther("0.5");
        }
        throw new Error(`Unexpected read ${functionName}`);
      }
    );
  }

  it("shows the wallet-global reward strip and manages the selected NFT", async () => {
    rewardsReads();
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />);

    expect(await screen.findByText("Genesis reward share")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update rewards" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Claim STATICS from past ownership" })
    ).toHaveProperty("disabled", false);

    expect(await screen.findByText("Effective reward weight: 12500")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim STATICS" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /#2/ }));
    expect(await screen.findByRole("button", { name: "Register for rewards" })).toBeInTheDocument();
    expect(screen.queryByText("Effective reward weight: 12500")).not.toBeInTheDocument();
  });

  it("keeps the permissionless strip usable with no owned NFTs", async () => {
    rewardsReads();
    discoverWalletGenesisIds.mockResolvedValue([]);
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />);

    expect(await screen.findByText("No Genesis NFTs found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update rewards" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /#1/ })).not.toBeInTheDocument();
  });
});
