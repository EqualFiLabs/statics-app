import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, renderWithLocale, screen, waitFor, within } from "@/test/render";
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
import spanish from "@/messages/es.json";

const readContract = vi.fn();
const getBlock = vi.fn();
const useBlock = vi.fn();
const loadRecoverableGenesisCredits = vi.fn();

vi.mock("wagmi", () => ({
  usePublicClient: () => ({ readContract, getBlock }),
  useBlock: (...args: unknown[]) => useBlock(...args),
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
  resolveNftMetadata: vi.fn().mockResolvedValue({
    image: "data:image/svg+xml,%3Csvg/%3E",
    traits: [
      { label: "Field", value: "Quiescent", max: null },
      { label: "Activation Tier", value: "2", max: 4 },
    ],
  }),
}));
const discoverWalletGenesisIds = vi.fn();

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

function vaultAccounting(epochActive: boolean) {
  // 655 circulating + 4,900 in the Vault = the fixed 5,555, and backing that
  // equals circulating x vaultPrice, so the solvency invariants actually hold.
  const backing = parseEther("117900000"); // 655 x 180,000
  return {
    vaultPrice: parseEther("180000"),
    maximumSupply: 5_555n,
    mintedSupply: 5_555n,
    vaultInventory: 4_900n,
    circulatingGenesis: 655n,
    tokenBacking: backing,
    grossBacking: backing,
    outstandingGenesisCredit: 0n,
    requiredBacking: backing,
    tokenCustody: backing,
    reserveETH: parseEther("5"),
    nativeCustody: parseEther("5"),
    genesisEpochEnd: 2_000_000_000n,
    epochActive,
    reserveBackingPerGenesis: parseEther("5") / 5_555n,
  };
}

function purchaseQuote(epochActive: boolean) {
  const reserveBuyIn = epochActive ? 0n : (parseEther("5") + 5_553n) / 5_554n;
  const nativeFee = parseEther("0.003");
  return {
    staticsPrice: parseEther("180000"),
    reserveBuyIn,
    nativeFee,
    requiredNative: reserveBuyIn + nativeFee,
    epochActive,
  };
}

function redemptionQuote(epochActive: boolean) {
  return {
    staticsPayout: parseEther("180000"),
    reservePayout: epochActive ? 0n : parseEther("5") / 5_555n,
    epochActive,
  };
}

function renderWithProviders(ui: React.ReactElement, signedIn = true, locale = "en") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
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
  return locale === "es" ? renderWithLocale(tree, locale, spanish) : render(tree);
}

beforeEach(() => {
  readContract.mockReset();
  getBlock.mockReset();
  useBlock.mockReturnValue({ data: { timestamp: 2_100_000_000n } });
  loadRecoverableGenesisCredits.mockReset();
  discoverWalletGenesisIds.mockReset();
});

describe("launch overview", () => {
  function overviewReads(epochActive: boolean) {
    discoverWalletGenesisIds.mockResolvedValue([]);
    readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === "vaultAccounting") return vaultAccounting(epochActive);
      if (functionName === "quoteGenesisPurchase") return purchaseQuote(epochActive);
      if (functionName === "quoteGenesisRedemption") return redemptionQuote(epochActive);
      if (functionName === "getSlot0") return [1n << 96n, 0, 0, 0];
      if (functionName === "getLiquidity") return 1n;
      if (functionName === "balanceOf") return parseEther("42");
      if (functionName === "genesisRewardShareBps") return 1_000;
      if (functionName === "totalWeight") return 25_000n;
      if (functionName === "ownerClaimable") return 0n;
      throw new Error(`Unexpected read ${functionName}`);
    });
  }

  it("leads with the Epoch and prices the acquisition inline", async () => {
    overviewReads(true);
    renderWithProviders(<DeploymentOverview />);

    expect(await screen.findByText("The Epoch ends in")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Acquire Operators/ })).toHaveAttribute(
      "href",
      "/app/swap?mode=nft"
    );
    expect(screen.getByRole("link", { name: "Buy STATICS" })).toHaveAttribute("href", "/app/swap");
    expect(screen.queryByText("Registered reward weight")).not.toBeInTheDocument();
  });

  it("renders the launch overview in Spanish", async () => {
    overviewReads(true);
    renderWithProviders(<DeploymentOverview />, true, "es");

    expect(await screen.findByText("La Época termina en")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Adquirir Operators/ })).toBeInTheDocument();
    expect(screen.getByText("Tus Operators")).toBeInTheDocument();
  });

  it("states what the deadline changes, in both directions", async () => {
    overviewReads(true);
    renderWithProviders(<DeploymentOverview />);

    // Await a figure rather than a static label, so the quotes have landed.
    expect(await screen.findByText("180,000 STATICS, no ETH")).toBeInTheDocument();
    expect(screen.getByText("Acquiring an Operator")).toBeInTheDocument();
    expect(screen.getByText("Redeeming an Operator")).toBeInTheDocument();
    expect(screen.getByText("Secured credit")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("Up to 171,000 STATICS")).toBeInTheDocument();
  });

  it("projects the buy-in from today's reserve rather than quoting zero", async () => {
    overviewReads(true);
    renderWithProviders(<DeploymentOverview />);

    // Charged buy-in is zero during the Epoch, but ceil(5 ETH / 5,554) is what
    // the next buyer owes the moment it ends -- and it climbs on every fee.
    // Await a quoted figure so the reads have landed, then scope: the reserve
    // share (R / 5,555) and the buy-in (R / 5,554) round to the same string at
    // this precision, which is the asymmetry working as designed.
    await screen.findByText("180,000 STATICS, no ETH");
    const row = screen.getByText("Buy-in if the Epoch ended now").closest("div");
    expect(row).toHaveTextContent("0.0009 ETH");
    expect(screen.getByText(/already accruing/)).toBeInTheDocument();
  });

  it("charges the buy-in once the Epoch is complete", async () => {
    overviewReads(false);
    renderWithProviders(<DeploymentOverview />);

    expect(await screen.findByText("The Epoch has ended")).toBeInTheDocument();
    expect(screen.getByText("Buy-in charged today")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Recover matured credit/ })).toHaveAttribute(
      "href",
      "/app/genesis/recoveries"
    );
  });

  it("verifies the three solvency invariants the Vault enforces", async () => {
    overviewReads(true);
    renderWithProviders(<DeploymentOverview />);

    expect(await screen.findByText("All three hold")).toBeInTheDocument();
    expect(screen.getByText("Backing covers every circulating Operators")).toBeInTheDocument();
    expect(screen.getByText("The Vault holds that STATICS")).toBeInTheDocument();
    expect(screen.getByText("The Vault holds the ETH reserve")).toBeInTheDocument();
    expect(screen.getByText("655 circulating × 180,000")).toBeInTheDocument();
  });

  it("reports the supply as one fixed collection", async () => {
    overviewReads(true);
    renderWithProviders(<DeploymentOverview />);

    expect(await screen.findByText("Fixed at 5,555")).toBeInTheDocument();
    expect(screen.getByText("Treasury at launch")).toBeInTheDocument();
    expect(screen.getByText("Vault inventory")).toBeInTheDocument();
  });

  it("prompts a signed-out visitor instead of showing dashes", async () => {
    overviewReads(true);
    renderWithProviders(<DeploymentOverview />, false);

    expect(await screen.findByText("Connect to see where you stand")).toBeInTheDocument();
    expect(screen.queryByText("Your Operators")).not.toBeInTheDocument();
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

  it("shows when the Epoch ends and no borrow controls during the Epoch", async () => {
    creditReads(true, false);
    renderWithProviders(<GenesisCreditPanel deployment={deployment} genesisId={1n} />);

    expect(await screen.findByText(/borrow up to 171,000 STATICS/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Borrow/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Amount to borrow")).not.toBeInTheDocument();
  });

  it("shows post-Epoch borrow controls when originations are open", async () => {
    creditReads(false, false);
    renderWithProviders(<GenesisCreditPanel deployment={deployment} genesisId={1n} />);

    expect(await screen.findByRole("button", { name: /^Borrow/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Amount to borrow")).toBeInTheDocument();
  });

  it("uses the latest chain timestamp for an advanced credit clock", async () => {
    const maturity = 2_100_000_000n;
    useBlock.mockReturnValue({ data: { timestamp: maturity + 30n * 86_400n + 86_401n } });
    readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === "vaultAccounting") return vaultAccounting(false);
      if (functionName === "creditOriginationsPaused") return false;
      if (functionName === "credit") {
        return {
          owner: wallet,
          principal: parseEther("1000"),
          maturity: Number(maturity),
          recoverableAt: Number(maturity + 3_600n),
          active: true,
        };
      }
      if (functionName === "creditLimit") return parseEther("171000");
      throw new Error(`Unexpected read ${functionName}`);
    });

    renderWithProviders(<GenesisCreditPanel deployment={deployment} genesisId={1n} />);

    expect(await screen.findByText("Recoverable in")).toBeInTheDocument();
    expect(screen.getByText("now")).toBeInTheDocument();
  });

  it("states the recovery consequence before any borrow is confirmed", async () => {
    creditReads(false, false);
    renderWithProviders(<GenesisCreditPanel deployment={deployment} genesisId={1n} />);

    expect(await screen.findByText(/Miss the deadline and you lose the NFT/i)).toBeInTheDocument();
    expect(screen.getByText("Recoverable")).toBeInTheDocument();
    expect(screen.getByText("1h grace")).toBeInTheDocument();
  });

  it("caps the borrow amount at this Genesis credit limit", async () => {
    creditReads(false, false);
    renderWithProviders(<GenesisCreditPanel deployment={deployment} genesisId={1n} />);

    const exact = await screen.findByLabelText("Or enter an exact amount");
    fireEvent.change(exact, { target: { value: "900000" } });

    expect(
      await screen.findByRole("button", { name: "Borrow 171,000 STATICS" })
    ).toBeInTheDocument();
  });

  it("shows only pause status when post-Epoch originations are paused", async () => {
    creditReads(false, true);
    renderWithProviders(<GenesisCreditPanel deployment={deployment} genesisId={1n} />);

    expect(
      await screen.findByText(/New Operator credit is temporarily paused/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Borrow/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Amount to borrow")).not.toBeInTheDocument();
  });
});

describe("Genesis recovery navigation", () => {
  it("does not expose Recoveries during the Genesis Epoch", async () => {
    readContract.mockResolvedValue(vaultAccounting(true));
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />, false);

    await waitFor(() => expect(readContract).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /Recover matured/ })).not.toBeInTheDocument();
  });

  it("exposes Recoveries after the Genesis Epoch without requiring an owned NFT", async () => {
    readContract.mockResolvedValue(vaultAccounting(false));
    getBlock.mockResolvedValue({ timestamp: 2_100_000_000n });
    loadRecoverableGenesisCredits.mockResolvedValue([]);
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />, false);

    expect(await screen.findByRole("link", { name: /Recover matured/ })).toHaveAttribute(
      "href",
      "/app/genesis/recoveries"
    );
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

  it("summarises the whole wallet before any single NFT", async () => {
    rewardsReads();
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />);

    expect(await screen.findByText("Operators held")).toBeInTheDocument();
    // Two NFTs at 2 STATICS each, plus 5 STATICS retained from past ownership.
    expect(screen.getByText("Claimable now").closest(".ui-stat")).toHaveTextContent("9 STATICS");
    expect(screen.getByText("Credit outstanding").closest(".ui-stat")).toHaveTextContent(
      "Nothing to repay"
    );
  });

  it("states the claim transaction count rather than hiding it", async () => {
    rewardsReads();
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />);

    // Two assets on each of two NFTs, plus both past-ownership assets.
    expect(
      await screen.findByRole("button", { name: "Claim all · 6 transactions" })
    ).toBeInTheDocument();
  });

  it("manages the selected NFT and switches between them", async () => {
    rewardsReads();
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />);

    fireEvent.click(await screen.findByRole("tab", { name: /^Rewards/ }));
    expect(await screen.findByText("Your weight")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Claim" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: /Operator #2/ }));
    expect(
      await screen.findByRole("button", { name: "Register Operator #2 for rewards" })
    ).toBeInTheDocument();
  });

  it("shows the activation ladder in full rather than a bare tier picker", async () => {
    rewardsReads();
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />);

    const ladder = await screen.findByRole("list", { name: "Activation tiers" });
    expect(within(ladder).getByText("Tier 0")).toBeInTheDocument();
    expect(within(ladder).getByText("Tier 4")).toBeInTheDocument();
    expect(within(ladder).getByText("You are here")).toBeInTheDocument();
    expect(within(ladder).getByText("1.25× reward weight")).toBeInTheDocument();
  });

  it("never describes activation as burning STATICS", async () => {
    rewardsReads();
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />);

    expect(await screen.findByText(/Paid to the Statics treasury/)).toBeInTheDocument();
    expect(screen.queryByText(/burn cost/i)).not.toBeInTheDocument();
  });

  it("keeps past-ownership rewards claimable when the wallet owns no Genesis", async () => {
    rewardsReads();
    discoverWalletGenesisIds.mockResolvedValue([]);
    renderWithProviders(<StandaloneGenesisPage deployment={deployment} />);

    expect(await screen.findByText("No Operators NFTs yet")).toBeInTheDocument();
    expect(screen.getByText("Rewards from past ownership")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Claim" })).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: /Operator #1/ })).not.toBeInTheDocument();
  });
});
