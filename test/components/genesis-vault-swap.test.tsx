import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@/test/render";
import { getAddress, parseEther, zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenesisVaultSwapPanel } from "@/components/genesis/GenesisVaultSwapPanel";
import type { DeploymentOption, LaunchDeployment } from "@/lib/deployments/types";
import { DeploymentContext } from "@/providers/deployment-context";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

const readContract = vi.fn();
const getBalance = vi.fn();
const discoverNextAvailableGenesisId = vi.fn();
const discoverWalletGenesisIds = vi.fn();

vi.mock("wagmi", () => ({
  usePublicClient: () => ({ readContract, getBalance }),
}));
vi.mock("@/lib/deployments/verify-launch", () => ({
  verifyLaunchDeployment: vi.fn().mockResolvedValue(undefined),
  verifyLaunchDeploymentCached: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/genesis/discovery", () => ({
  discoverNextAvailableGenesisId: (...args: unknown[]) => discoverNextAvailableGenesisId(...args),
  discoverWalletGenesisIds: (...args: unknown[]) => discoverWalletGenesisIds(...args),
}));
vi.mock("@/lib/wallet/nft-image", () => ({
  resolveNftImage: vi.fn().mockResolvedValue(null),
  resolveNftMetadata: vi.fn().mockResolvedValue({ image: null, traits: [] }),
}));

const statics = getAddress("0x1111111111111111111111111111111111111111");
const weth = getAddress("0x7777777777777777777777777777777777777777");
const wallet = getAddress("0x2222222222222222222222222222222222222222");
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

function reads({ credits = new Map<string, boolean>() }: { credits?: Map<string, boolean> } = {}) {
  readContract.mockImplementation(
    async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
      if (functionName === "quoteGenesisPurchase") {
        return {
          staticsPrice: parseEther("180000"),
          reserveBuyIn: 0n,
          nativeFee: parseEther("0.003"),
          requiredNative: parseEther("0.003"),
          epochActive: true,
        };
      }
      if (functionName === "quoteGenesisRedemption") {
        return {
          staticsPayout: parseEther("180000"),
          reservePayout: 0n,
          epochActive: true,
        };
      }
      if (functionName === "vaultAccounting") {
        return {
          vaultPrice: parseEther("180000"),
          maximumSupply: 5_555n,
          vaultInventory: 4_900n,
          circulatingGenesis: 655n,
          epochActive: true,
        };
      }
      if (functionName === "credit") {
        return { active: credits.get(String(args?.[0])) ?? false, principal: 0n };
      }
      if (functionName === "balanceOf") return parseEther("84120.55");
      throw new Error(`Unexpected read ${functionName}`);
    }
  );
  getBalance.mockResolvedValue(parseEther("2.418"));
  discoverNextAvailableGenesisId.mockResolvedValue(4_913n);
  discoverWalletGenesisIds.mockResolvedValue([]);
}

function renderPanel() {
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
          <GenesisVaultSwapPanel deployment={deployment} />
        </WalletContext.Provider>
      </DeploymentContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  readContract.mockReset();
  getBalance.mockReset();
  discoverNextAvailableGenesisId.mockReset();
  discoverWalletGenesisIds.mockReset();
});

describe("Genesis Vault trade card", () => {
  it("names the shortfall instead of failing after the click", async () => {
    // The wallet holds 84,120.55 against a 180,000 price. Previously the button
    // was enabled and buy() threw once the transaction was already in flight.
    reads();
    renderPanel();

    expect(await screen.findByText(/You need 95,879.45 more STATICS/)).toBeInTheDocument();
    const action = screen.getByRole("button", { name: "Not enough to acquire" });
    expect(action).toBeDisabled();
  });

  it("checks the native leg as well as the STATICS leg", async () => {
    reads();
    getBalance.mockResolvedValue(parseEther("0.001"));
    renderPanel();

    expect(await screen.findByText(/more ETH/)).toBeInTheDocument();
  });

  it("enables the action once both legs are covered", async () => {
    reads();
    readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === "quoteGenesisPurchase") {
        return {
          staticsPrice: parseEther("180000"),
          reserveBuyIn: 0n,
          nativeFee: parseEther("0.003"),
          requiredNative: parseEther("0.003"),
          epochActive: true,
        };
      }
      if (functionName === "quoteGenesisRedemption") {
        return { staticsPayout: parseEther("180000"), reservePayout: 0n, epochActive: true };
      }
      if (functionName === "vaultAccounting") {
        return {
          vaultPrice: parseEther("180000"),
          maximumSupply: 5_555n,
          vaultInventory: 4_900n,
          circulatingGenesis: 655n,
          epochActive: true,
        };
      }
      if (functionName === "balanceOf") return parseEther("264120.55");
      throw new Error(`Unexpected read ${functionName}`);
    });
    renderPanel();

    expect(
      await screen.findByRole("button", { name: "Acquire Operators #4913" })
    ).not.toBeDisabled();
  });

  it("marks a credit-locked Genesis before it can be chosen to redeem", async () => {
    reads({ credits: new Map([["4419", true]]) });
    discoverWalletGenesisIds.mockResolvedValue([1204n, 4419n]);
    renderPanel();

    fireEvent.click(await screen.findByRole("tab", { name: "Redeem" }));

    const locked = await screen.findByRole("radio", { name: /4419/ });
    expect(locked).toBeDisabled();
    expect(screen.getByRole("radio", { name: /1204/ })).not.toBeDisabled();
  });

  it("states what redemption returns", async () => {
    reads();
    discoverWalletGenesisIds.mockResolvedValue([1204n]);
    renderPanel();

    fireEvent.click(await screen.findByRole("tab", { name: "Redeem" }));

    expect(await screen.findByText("You receive")).toBeInTheDocument();
    expect(screen.getByText("180,000 STATICS")).toBeInTheDocument();
    // No reserve share is paid while the Epoch runs, and the panel says so.
    expect(
      screen.getByText(/No reserve share is paid until the Genesis Epoch ends/)
    ).toBeInTheDocument();
  });

  it("reports what is left rather than repeating the Overview's accounting", async () => {
    reads();
    renderPanel();

    expect(await screen.findByText(/left in the Vault/)).toBeInTheDocument();
    expect(screen.queryByText("Outstanding credit")).not.toBeInTheDocument();
    expect(screen.queryByText("Native reserve")).not.toBeInTheDocument();
  });
});
