import { cleanup } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { liquidityLegQuery } from "@/lib/rewards/gauge-reads";
import type { PublicClient, Address } from "viem";
import { act } from "react";
import {
  announceProtocolTransactionConfirmed,
  protocolQueryScopes,
} from "@/lib/protocol/reconciliation";
import { ProtocolQueryReconciler } from "@/providers/ProtocolQueryReconciler";
import { fireEvent, render, screen, waitFor, within } from "@/test/render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  maxUint256,
  encodeFunctionResult,
  parseEther,
  zeroAddress,
} from "viem";
import { staticsAbi as phaseOneStaticsAbi } from "@statics-protocol/sdk/phase-one";
import {
  staticsBatchRewardsAbi as legacyBatchRewardsAbi,
  staticsAggregatedBatchRewardsAbi,
} from "@statics-protocol/sdk";
const staticsBatchRewardsAbi = [
  ...legacyBatchRewardsAbi,
  ...staticsAggregatedBatchRewardsAbi,
] as const;
import { staticsGaugeIncentivesAbi } from "@statics-protocol/sdk/phase-one";
import { PositionListPage } from "@/components/positions/PositionListPage";
import { RewardsPage } from "@/components/rewards/RewardsPage";
import type { DeploymentOption, PhaseOneDeployment } from "@/lib/deployments/types";
import {
  AllocationDirectoryChangedError,
  type IndexedAllocationPool,
} from "@/lib/indexer/phase-one";
import { DeploymentContext } from "@/providers/deployment-context";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  execute: vi.fn(),
  page: vi.fn(),
  position: vi.fn(),
  simulate: vi.fn(),
  call: vi.fn(),
  allocations: vi.fn(),
  directory: vi.fn(),
  managed: vi.fn(),
  block: vi.fn(),
  params: new URLSearchParams(),
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.params,
}));
vi.mock("wagmi", () => ({
  usePublicClient: () => ({
    chain: { id: 31337 },
    readContract: mocks.read,
    call: mocks.call,
    getBlockNumber: async () => 10n,
    simulateContract: mocks.simulate,
    getBlock: mocks.block,
  }),
}));
vi.mock("@/lib/protocol/transactions", () => ({ executeProtocolTransaction: mocks.execute }));
vi.mock("@/lib/indexer/phase-one", async (original) => ({
  ...(await original<typeof import("@/lib/indexer/phase-one")>()),
  loadIndexedPhaseOnePositions: mocks.page,
  loadIndexedPhaseOnePosition: mocks.position,
  loadIndexedAllocationSnapshot: mocks.allocations,
  loadAllocationDirectory: mocks.directory,
  loadIndexedManagedLiquidity: mocks.managed,
}));
const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const wallet = getAddress(`0x${"ab".repeat(20)}`);
const tokens = ["STATICS", "WETH", "TOKEN"].map((symbol, index) => ({
  address: address(String(index + 2)),
  name: symbol,
  symbol,
  decimals: 18,
  metadataSource: "reviewed-manifest" as const,
}));
const currentVersion = hash("a");
/** A directory pool as the indexer parser returns it. */
const directoryPool = (
  poolId: `0x${string}`,
  overrides: Partial<IndexedAllocationPool> = {}
): IndexedAllocationPool =>
  ({
    poolId,
    poolKey: {
      currency0: tokens[0].address,
      currency1: tokens[1].address,
      hooks: address("9"),
      fee: 3000,
      tickSpacing: 60,
    },
    token0: { address: tokens[0].address, symbol: "STATICS", name: "Statics", decimals: 18 },
    token1: { address: tokens[1].address, symbol: "WETH", name: "WETH", decimals: 18 },
    creator: address("8"),
    eligibility: { eligible: true, reasons: [] },
    weight: parseEther("100"),
    stale: false,
    gaugeInitialized: true,
    gaugeStopped: false,
    decommissioned: false,
    decommissionStarted: false,
    decommissionFinalized: false,
    quarantined: false,
    restrictionFlags: { token0: false, token1: false },
    currentVersion,
    storedVersion: currentVersion,
    allocatorStreams: [
      {
        slot: 1,
        asset: { address: tokens[1].address, symbol: "WETH", name: "WETH", decimals: 18 },
        allocatorShareBps: 5000,
        eligibilityVersion: currentVersion,
        fundingRestrictionSequence: 0n,
        periodStart: 0n,
        periodFinish: 2_000_000n,
        lastUpdate: 0n,
        periodBudget: parseEther("14"),
        periodEmitted: 0n,
        terminated: false,
        observedAtBlock: 1n,
        observedAtTimestamp: 1n,
        funded: true,
        paused: false,
        invalidated: false,
        rateNumerator: parseEther("14"),
        rateDenominator: 1_209_600n,
        nominalRatePerSecond: 0n,
        ratePerSecond: 0n,
      },
    ],
    incentiveStreamCount: 1,
    createdAtBlock: 1n,
    updatedAtBlock: 1n,
    observedAtTimestamp: 1n,
    weightObservedAtBlock: 1n,
    ...overrides,
  }) as IndexedAllocationPool;
const directoryPage = (items: IndexedAllocationPool[]) => ({
  deploymentId: "phase-one-fixture",
  indexedAtBlock: 1n,
  indexedAtTimestamp: 1n,
  directoryRevision: 1n,
  reserve: {
    activated: true,
    periodBudget: parseEther("700"),
    periodStart: 0n,
    periodFinish: 604_800n,
    totalAllocatedWeight: parseEther("200"),
    observedAtBlock: 1n,
    observedAtTimestamp: 1n,
    periodExpired: false,
  },
  items,
  nextCursor: null,
  total: items.length,
});
const phaseOne = {
  kind: "phase-one",
  descriptor: {
    deploymentId: "phase-one-fixture",
    label: "Statics",
    network: "Anvil",
    chainId: 31337,
    stage: "phase-one",
    capabilities: ["public-lp-positions", "position-staking"],
    available: true,
  },
  contracts: { diamond: address("1"), statics: tokens[0].address, weth: tokens[1].address },
  supportedPools: [0, 1].map((index) => ({
    poolId: hash(String(index + 1)),
    poolKey: {
      currency0: tokens[0].address,
      currency1: tokens[index + 1].address,
      fee: 3000,
      tickSpacing: 60,
      hooks: address("4"),
    },
    token0: tokens[0],
    token1: tokens[index + 1],
    enabled: true,
    provenance: {
      deploymentId: "phase-one-fixture",
      protocolCommit: "fixture",
      registrationBlock: 1n,
    },
  })),
} as unknown as PhaseOneDeployment;
const option = {
  networkId: "anvil",
  descriptor: phaseOne.descriptor,
  launch: null,
  phaseOne,
  protocol: null,
} satisfies DeploymentOption;
const position = (id: bigint) => ({
  positionId: id,
  owner: wallet,
  stakedBalance: parseEther("100"),
  activeLegCount: 0n,
  unresolvedObligationCount: 0n,
  updatedAtBlock: 1n,
});
function withPhaseOne(ui: React.ReactElement, deployment = phaseOne) {
  const active = { ...option, phaseOne: deployment };
  return render(
    <DeploymentContext.Provider value={{ active, options: [active], selectNetwork: vi.fn() }}>
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "ready",
          address: wallet,
          chainId: 31337,
          isTargetChain: true,
        }}
      >
        {ui}
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
}
beforeEach(() => {
  mocks.block.mockReset().mockResolvedValue({ timestamp: 3000n });
  mocks.params = new URLSearchParams();
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.directory.mockReset().mockResolvedValue(directoryPage([]));
  mocks.managed.mockReset().mockResolvedValue([]);
  window.localStorage.clear();
  mocks.allocations.mockReset().mockResolvedValue({
    totalAllocated: parseEther("30"),
    lockedStake: parseEther("30"),
    allocations: [],
    nextAllocationAt: 0n,
  });
  mocks.call.mockReset().mockImplementation(async ({ data }) => {
    const decoded = decodeFunctionData({ abi: staticsBatchRewardsAbi, data });
    if (decoded.functionName !== "batchClaimRewardsAggregated") throw Error("Wrong batch");
    return {
      data: encodeFunctionResult({
        abi: staticsBatchRewardsAbi,
        functionName: "batchClaimRewardsAggregated",
        result: [
          decoded.args[0].map((group) => group.assets.map(() => parseEther("3"))),
          decoded.args[1].map((group) =>
            group.slots.map((slot) => parseEther(slot === 0 ? "1" : "2"))
          ),
          decoded.args[2].map((group) => group.slots.map(() => parseEther("4"))),
        ],
      }),
    };
  });
  mocks.simulate.mockReset();
  mocks.execute.mockReset().mockResolvedValue(hash("f"));
  mocks.position.mockReset().mockImplementation(async (id) => position(id));
  mocks.page.mockReset().mockResolvedValue({
    deploymentId: "phase-one-fixture",
    indexedAtBlock: 1n,
    items: [position(1n)],
    nextCursor: null,
  });
  mocks.read.mockReset().mockImplementation(async ({ functionName, args }) => {
    if (functionName === "poolRewardConfig") return { slotCount: 2 };
    if (functionName === "batchClaimLimits") return [16n, 64n];
    if (functionName === "supportsInterface") return true;
    if (functionName === "rewardSelection") return { pendingStake: 0n, eligibleAt: 0n };
    if (functionName === "rewardSelectionWithTiming")
      return [{ pendingStake: 0n, eligibleAt: 0n }, 0];
    if (functionName === "previewGaugeAllocatorRewards")
      return args[2].map((slot: number) => ({
        slot,
        asset: tokens[1].address,
        allocation: parseEther("10"),
        amount: parseEther("4"),
      }));
    if (functionName === "positionCreationFee") return 1n;
    if (functionName === "stakePosition")
      return { stakedBalance: parseEther("100"), rewardMultiplierBps: 10000 };
    if (functionName === "positionRewardAssets") return [tokens[0].address];
    if (functionName === "globalRewardAssetsOfPosition") return [[tokens[0].address], 1n];
    if (functionName === "pendingRewards") return [parseEther("3")];
    if (functionName === "maxRewardAssetsPerPosition") return 10n;
    if (functionName === "gaugeAllocationCooldown") return 14_400;
    if (functionName === "rewardEligibilityDelay") return 86_400n;
    if (functionName === "rewardEligibilityBucketSize") return 3_600n;
    if (functionName === "gaugePositionAllocations")
      return [
        0,
        parseEther("30"),
        [
          { poolId: hash("1"), amount: parseEther("10"), eligibilityVersion: hash("a") },
          { poolId: hash("2"), amount: parseEther("20"), eligibilityVersion: hash("b") },
        ],
        parseEther("30"),
      ];
    if (functionName === "maxGaugeAllocationsPerPosition") return 10n;
    if (functionName === "positionGaugePools") return [[hash("1")], 1n];
    if (functionName === "positionGaugeAllocatorPools") return [[hash("1"), hash("2")], 2n];
    if (functionName === "previewLpRewards")
      return {
        slotCount: 2,
        assets: [tokens[0].address, tokens[1].address, zeroAddress, zeroAddress, zeroAddress],
        amounts: [parseEther(args[1] === hash("1") ? "1" : "9"), parseEther("2"), 0n, 0n, 0n],
      };
    if (functionName === "gaugeReserve")
      return {
        activated: false,
        periodFinish: 0,
        lastCheckpoint: 0,
        periodBudget: 0n,
        totalAllocatedWeight: 0n,
      };
    if (functionName === "gaugePool")
      return { stopped: false, referenceTick: 0, activeGaugeLiquidity: 0n };
    if (functionName === "gaugePoolWeight") return { weight: 0n, stale: false };
    if (functionName === "maxGaugeCatchupPeriods") return 10;
    if (functionName === "lpLeg") return { liquidity: 0n, tickLower: -60, tickUpper: 60 };
    if (functionName === "balanceOf") return parseEther("500");
    if (functionName === "allowance") return maxUint256;
    if (functionName === "rewardBookNeedsCheckpoint") return false;
    if (functionName === "unfundedSwapRewards") return 0n;
    throw new Error(`Unexpected RPC ${functionName}`);
  });
  mocks.simulate.mockImplementation(async ({ functionName, args }) => {
    if (functionName === "claimGaugeAllocatorRewards") {
      const rewards = await mocks.read({
        functionName: "previewGaugeAllocatorRewards",
        args: args.slice(0, 3),
      });
      return { result: rewards.map((reward: { amount: bigint }) => reward.amount) };
    }
    throw new Error(`Unexpected simulation ${functionName}`);
  });
});

describe("focused Phase 1 Earn", () => {
  it("lists accounts like a ledger with holdings, status and filters", async () => {
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [
        position(1n),
        { ...position(2n), activeLegCount: 1n },
        { ...position(3n), stakedBalance: 0n },
      ],
      nextCursor: null,
    });
    mocks.managed.mockImplementation(async (positionId: bigint) =>
      positionId === 2n
        ? [
            {
              positionId,
              poolId: hash("1"),
              posmTokenId: 9n,
              tickLower: -600,
              tickUpper: 600,
              liquidity: parseEther("10"),
              active: true,
            },
          ]
        : []
    );
    const original = mocks.read.getMockImplementation()!;
    // The pool trades above the range, so that liquidity is all token1 and not earning.
    mocks.read.mockImplementation((input) =>
      input.functionName === "getSlot0" ? [2n ** 96n * 2n, 13_863, 0, 0] : original(input)
    );
    window.localStorage.setItem(
      `statics:account-nicknames:phase-one-fixture:${wallet.toLowerCase()}`,
      JSON.stringify({ "1": "Savings" })
    );
    withPhaseOne(<PositionListPage />);
    const savings = await screen.findByRole("link", { name: /^Savings, Position NFT #1, Active/ });
    expect(savings).toHaveAttribute("href", "/app/positions/1");
    expect(within(savings).getByText("Active")).toBeInTheDocument();
    const second = await screen.findByRole("link", { name: /^Account #2,/ });
    await waitFor(() => expect(within(second).getByText("Needs attention")).toBeInTheDocument());
    expect(within(second).getByText(/1 liquidity position, 1 out of range/)).toBeInTheDocument();
    expect(
      within(second).getByText("Liquidity is out of range and not earning.")
    ).toBeInTheDocument();
    expect(within(second).getByText("WETH")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /^3 accounts · 1 need attention · 1 empty/
    );
    fireEvent.click(screen.getByRole("button", { name: /^Empty/ }));
    expect(within(screen.getByRole("list")).getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /^Account #3,/ })).toHaveTextContent(
      "Empty · can close"
    );
    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find an account" }), {
      target: { value: "sav" },
    });
    expect(within(screen.getByRole("list")).getAllByRole("link")).toHaveLength(1);
  });
  it("marks account holdings incomplete when liquidity discovery fails", async () => {
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [{ ...position(1n), activeLegCount: 1n }],
      nextCursor: null,
    });
    mocks.managed.mockRejectedValue(new Error("Indexer unavailable"));
    withPhaseOne(<PositionListPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Figures shown may be incomplete");
    const row = screen.getByRole("link", { name: /^Account #1,/ });
    expect(within(row).getByText("…")).toBeInTheDocument();
    expect(within(row).queryByText("Nothing held")).not.toBeInTheDocument();
  });
  it("reports failed reward reads and avoids unrelated staking-management reads", async () => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "pendingRewards"
        ? Promise.reject(new Error("Reward RPC unavailable"))
        : original(input)
    );
    withPhaseOne(<PositionListPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Figures shown may be incomplete");
    expect(screen.getByRole("status")).not.toHaveTextContent("rewards ready on");
    expect(
      mocks.read.mock.calls.some(([input]) =>
        ["maxRewardAssetsPerPosition", "rewardSelectionWithTiming", "rewardSelection"].includes(
          input.functionName
        )
      )
    ).toBe(false);
  });
  it("uses explicit base units when pool token decimals are unavailable", async () => {
    const poolId = hash("a");
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [{ ...position(1n), activeLegCount: 1n }],
      nextCursor: null,
    });
    mocks.managed.mockResolvedValue([
      {
        positionId: 1n,
        poolId,
        posmTokenId: 9n,
        tickLower: -600,
        tickUpper: 600,
        liquidity: parseEther("10"),
        active: true,
      },
    ]);
    mocks.directory.mockResolvedValue(
      directoryPage([
        directoryPool(poolId, {
          token0: { address: address("8"), symbol: "UNKNOWN", name: null, decimals: null },
        }),
      ])
    );
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "getSlot0" ? [2n ** 96n, 0, 0, 0] : original(input)
    );
    withPhaseOne(<PositionListPage />);
    expect(await screen.findByText(/base units/)).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });
  it("refreshes account liquidity after a confirmed write with an unchanged position block", async () => {
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [{ ...position(1n), activeLegCount: 1n }],
      nextCursor: null,
    });
    mocks.managed.mockResolvedValue([
      {
        positionId: 1n,
        poolId: hash("1"),
        posmTokenId: 9n,
        tickLower: -600,
        tickUpper: 600,
        liquidity: parseEther("10"),
        active: true,
      },
    ]);
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "getSlot0" ? [2n ** 96n, 0, 0, 0] : original(input)
    );
    withPhaseOne(
      <>
        <ProtocolQueryReconciler />
        <PositionListPage />
      </>
    );
    await screen.findByText("WETH");
    const reads = mocks.managed.mock.calls.length;
    act(() =>
      announceProtocolTransactionConfirmed({
        wallet,
        chainId: 31337,
        deploymentId: "phase-one-fixture",
        blockNumber: 11n,
        kind: "phase-one-increase-liquidity",
        scopes: protocolQueryScopes("phase-one-increase-liquidity"),
      })
    );
    await waitFor(() => expect(mocks.managed.mock.calls.length).toBeGreaterThan(reads));
  });
  it("opens a new account from the accounts list", async () => {
    withPhaseOne(<PositionListPage />);
    expect(await screen.findByRole("link", { name: /^Account #1,/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stake STATICS" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open account" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("lists a newly opened account without a reload once the indexer catches up", async () => {
    mocks.execute.mockImplementation(async (request) => {
      await request.verifyConfirmation?.({
        logs: [
          {
            address: address("1"),
            topics: encodeEventTopics({
              abi: phaseOneStaticsAbi,
              eventName: "PositionCreated",
              args: { positionId: 2n, owner: wallet },
            }),
            data: "0x",
          },
        ],
      });
      const page = (items: ReturnType<typeof position>[]) => ({
        deploymentId: "phase-one-fixture",
        indexedAtBlock: 1n,
        items,
        nextCursor: null,
      });
      // The first refresh after confirmation still returns the old list.
      mocks.page
        .mockResolvedValueOnce(page([position(1n)]))
        .mockResolvedValue(page([position(1n), position(2n)]));
      return hash("f");
    });
    withPhaseOne(<PositionListPage />);
    await screen.findByRole("link", { name: /^Account #1,/ });
    fireEvent.click(screen.getByRole("button", { name: "Open account" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm transaction" }));
    // The account row (not just the interim link) appears without a reload.
    await waitFor(
      () => expect(screen.getByRole("link", { name: /^Account #2,/ })).toBeInTheDocument(),
      { timeout: 5_000 }
    );
  });
  it("shows a multi-position table with a wallet-wide Collect and no management controls", async () => {
    withPhaseOne(<RewardsPage />);
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Earn" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Positions" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review stake" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
  });
  it("selects, collects and hides positions from the overview table", async () => {
    window.localStorage.clear();
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [position(1n), position(2n)],
      nextCursor: null,
    });
    withPhaseOne(<RewardsPage />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select Position #2" }));
    const bulk = screen.getByRole("region", { name: "Actions for selected positions" });
    expect(within(bulk).getByText("1 position selected")).toBeInTheDocument();
    expect(within(bulk).getByRole("button", { name: "Collect selected" })).toBeInTheDocument();
    fireEvent.click(within(bulk).getByRole("button", { name: "Hide" }));
    await waitFor(() =>
      expect(screen.queryByRole("checkbox", { name: "Select Position #2" })).not.toBeInTheDocument()
    );
    expect(screen.getByRole("checkbox", { name: "Select Position #1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show hidden · 1" }));
    expect(await screen.findByRole("checkbox", { name: "Select Position #2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collect" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const reviewed = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls[0][0].data,
    });
    if (reviewed.functionName === "batchClaimRewardsAggregated")
      expect(reviewed.args[0].map((group) => group.positionId)).toEqual([1n, 2n]);
    window.localStorage.clear();
  });
  it("clears selected positions when search hides a row", async () => {
    window.localStorage.clear();
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [position(1n), position(2n)],
      nextCursor: null,
    });
    withPhaseOne(<RewardsPage />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select Position #2" }));
    expect(
      screen.getByRole("region", { name: "Actions for selected positions" })
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "#1" } });
    expect(
      screen.queryByRole("region", { name: "Actions for selected positions" })
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(screen.getByRole("checkbox", { name: "Select Position #2" })).not.toBeChecked();
    expect(
      screen.queryByRole("region", { name: "Actions for selected positions" })
    ).not.toBeInTheDocument();
  });
  it("loads ownership beyond 100 and pages the stake picker to an explicitly requested NFT", async () => {
    mocks.params = new URLSearchParams("positionId=101");
    mocks.page.mockImplementation(async (_owner, _deployment, _url, cursor) => ({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: cursor
        ? [position(101n)]
        : Array.from({ length: 100 }, (_, i) => position(BigInt(i + 1))),
      nextCursor: cursor ? null : "100",
    }));
    withPhaseOne(<RewardsPage earnView="staking" />);
    expect(await screen.findByRole("radio", { name: /Position #101/ })).toBeChecked();
    expect(screen.getByText("101–101 of 101")).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: /^Position #/ })).toHaveLength(1);
    expect(mocks.page.mock.calls.at(-1)?.[3]).toBe("100");
    await waitFor(() =>
      expect(
        mocks.read.mock.calls.some(
          ([input]) => input.functionName === "stakePosition" && input.args[0] === 101n
        )
      ).toBe(true)
    );
    // Only the visible page, the selection and the largest position are read on-chain.
    expect(
      mocks.read.mock.calls.some(
        ([input]) => input.functionName === "stakePosition" && input.args[0] === 50n
      )
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Previous positions" }));
    expect(await screen.findByText("96–100 of 101")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Position #101/ })).toBeChecked();
  });
  it("rejects a missing or foreign position without falling back to another NFT", async () => {
    mocks.params = new URLSearchParams("positionId=999");
    withPhaseOne(<RewardsPage earnView="staking" />);
    await screen.findByText("This position is missing or belongs to another wallet.");
    expect(screen.getByRole("link", { name: "Reset filters" })).toHaveAttribute(
      "href",
      "/app/rewards/staking"
    );
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("redirects old Phase 1 position links to Staking", async () => {
    mocks.params = new URLSearchParams("positionId=1");
    withPhaseOne(<RewardsPage initialPositionId={1n} />);
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/app/rewards/staking?positionId=1")
    );
  });
  it("does not perform pool, LP, or reserve reads on the initial staking screen", async () => {
    withPhaseOne(<RewardsPage earnView="staking" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    // Allocation lock and cooldown are read because stake and unstake previews depend on them.
    expect(
      mocks.read.mock.calls.some(([input]) =>
        /positionGaugePools|lpLeg|previewLp|Reserve|poolRewardConfig/i.test(input.functionName)
      )
    ).toBe(false);
    expect(mocks.allocations).not.toHaveBeenCalled();
  });
  it("reads only LP reward sources on Liquidity rewards and survives an unrelated allocator failure", async () => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "positionGaugeAllocatorPools"
        ? Promise.reject(Error("allocator unavailable"))
        : original(input)
    );
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    expect(
      mocks.read.mock.calls.some(([input]) =>
        [
          "stakePosition",
          "positionGaugeAllocatorPools",
          "gaugePositionAllocations",
          "globalRewardAssetsOfPosition",
        ].includes(input.functionName)
      )
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Collect" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const decoded = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls[0][0].data,
    });
    // No global or allocator claims; one LP claim covering emissions (slot 0) and incentives.
    expect(decoded.args?.[0]).toEqual([]);
    expect(decoded.args?.[2]).toEqual([]);
    expect(decoded.args?.[1]).toMatchObject([{ positionId: 1n, slots: [0, 1] }]);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("collects only allocator incentives on Allocations, with no LP reads", async () => {
    withPhaseOne(<RewardsPage earnView="allocations" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    expect(
      mocks.read.mock.calls.some(([input]) =>
        ["positionGaugePools", "lpLeg", "previewLpRewards"].includes(input.functionName)
      )
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Collect" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const decoded = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls[0][0].data,
    });
    expect(decoded.args?.[1]).toEqual([]);
    expect(decoded.args?.[2]).toHaveLength(2);
  });
  it("collects selected pools with synchronized expanded position checkboxes", async () => {
    const poolIds = Array.from(
      { length: 12 },
      (_, index) => `0x${(index + 1).toString(16).padStart(64, "0")}`
    );
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "positionGaugePools" ? [poolIds, 12n] : original(input)
    );
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    const [first] = screen.getAllByRole("checkbox", { name: /^Select all positions in/ });
    fireEvent.click(first);
    expect(screen.getByText("1 leg selected")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /^Show positions in/ })[0]);
    expect(screen.getByRole("checkbox", { name: /^Select Position #1 in/ })).toBeChecked();
    expect(first).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Collect selected" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const selected = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls[0][0].data,
    });
    expect(selected.args?.[1]).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(first);
    fireEvent.click(screen.getByRole("button", { name: "Collect" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const decoded = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls.at(-1)![0].data,
    });
    expect(decoded.args?.[1]).toHaveLength(12);
  });
  it("preserves applicable URL filters in feature navigation", async () => {
    mocks.params = new URLSearchParams(
      `positionId=1&poolId=${hash("1")}&asset=${tokens[1].address}&share=allocator`
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    expect(screen.queryByRole("link", { name: "Bribe Rewards" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Liquidity rewards" })).toHaveAttribute(
      "href",
      `/app/rewards/gauge?positionId=1&poolId=${hash("1")}&asset=${tokens[1].address}`
    );
    expect(screen.getByRole("link", { name: "Staking" })).toHaveAttribute(
      "href",
      `/app/rewards/staking?positionId=1&asset=${tokens[1].address}`
    );
    expect(screen.getByRole("link", { name: "Allocations" })).toHaveAttribute(
      "href",
      `/app/rewards/allocations?positionId=1&poolId=${hash("1")}`
    );
  });
  it("keeps known positions stakeable when the rest of ownership fails", async () => {
    mocks.page.mockImplementation(async (_owner, _id, _url, cursor) => {
      if (cursor) throw Error("Indexer unavailable");
      return {
        deploymentId: "phase-one-fixture",
        indexedAtBlock: 1n,
        items: [position(1n)],
        nextCursor: "1",
      };
    });
    withPhaseOne(<RewardsPage earnView="staking" />);
    await screen.findByText(/Some data could not be loaded/);
    // Known positions stay usable for staking while the rest of ownership is unavailable.
    expect(await screen.findByRole("radio", { name: /Position #1/ })).toBeChecked();
  });
  it("clearing one allocation preserves other pools, with no reward-source reads", async () => {
    withPhaseOne(<RewardsPage earnView="allocations" />);
    await screen.findAllByRole("button", { name: /^Adjust allocation to / });
    fireEvent.click(screen.getAllByRole("button", { name: /^Show positions in / })[0]);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Remove Position #1 allocation to STATICS / WETH",
      })
    );
    // Remove opens the editor on that allocation, ready for the amount to take off it.
    const editor = await screen.findByRole("dialog", { name: "Manage allocations" });
    const amount = within(editor).getByRole("textbox", {
      name: "Amount to add to or remove from STATICS / WETH, Position #1",
    });
    expect(amount).toHaveFocus();
    const remove = within(editor).getByRole("button", {
      name: "Remove from STATICS / WETH on Position #1",
    });
    // A partial removal takes exactly the amount entered.
    fireEvent.change(amount, { target: { value: "4" } });
    fireEvent.click(remove);
    expect(within(editor).getByText("6 STATICS allocated")).toBeInTheDocument();
    expect(amount).toHaveValue("");
    expect(within(editor).getByText(/^Locked: 30 → 26 STATICS\./)).toBeInTheDocument();
    fireEvent.change(amount, { target: { value: "80" } });
    expect(remove).toBeDisabled();
    expect(
      within(editor).getByText("You can add up to 74 STATICS or remove up to 6 STATICS.")
    ).toBeInTheDocument();
    fireEvent.change(amount, { target: { value: "6" } });
    fireEvent.click(remove);
    expect(within(editor).getByText(/10 STATICS becomes free to unstake/)).toBeInTheDocument();
    fireEvent.click(within(editor).getByRole("button", { name: "Add to changes" }));
    // Removal is staged, not sent: the row shows it pending and the change set summarises it.
    expect(await screen.findByText("Pending → 0")).toBeInTheDocument();
    const changes = screen.getByRole("region", { name: "Actions for selected allocations" });
    expect(within(changes).getByText("1 position · 1 transaction")).toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.click(within(changes).getByRole("button", { name: "Review changes" }));
    const review = await screen.findByRole("dialog", { name: "Review allocation changes" });
    expect(within(review).getByText("Position #1: STATICS / WETH 10 → 0")).toBeInTheDocument();
    expect(within(review).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled());
    const decoded = decodeFunctionData({
      abi: staticsGaugeIncentivesAbi,
      data: mocks.execute.mock.calls.at(-1)![0].data,
    });
    expect(decoded.args).toEqual([1n, [hash("2")], [parseEther("20")]]);
    expect(
      mocks.read.mock.calls.some(([input]) =>
        ["previewLpRewards", "positionGaugePools", "pendingRewards"].includes(input.functionName)
      )
    ).toBe(false);
  });
  it("reviews staking in a drawer and retains its draft after cancellation", async () => {
    withPhaseOne(<RewardsPage earnView="staking" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    fireEvent.click(screen.getByRole("button", { name: "Review stake" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("500 STATICS")).toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.click(within(drawer).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("textbox", { name: "STATICS amount" })).toHaveValue("500");
  });
  it("excludes gauge-locked stake from unstake Max", async () => {
    withPhaseOne(<RewardsPage earnView="staking" />);
    fireEvent.click(await screen.findByRole("button", { name: "Unstake" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(screen.getByRole("textbox", { name: "STATICS amount" })).toHaveValue("70");
    fireEvent.change(screen.getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "71" },
    });
    expect(
      screen.getByText("Amount exceeds the stake you can unstake from this position.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage allocations" })).toHaveAttribute(
      "href",
      "/app/rewards/allocations?positionId=1&unlock=1000000000000000000"
    );
  });
  it("previews the eligibility delay and allocation cooldown before staking", async () => {
    withPhaseOne(<RewardsPage earnView="staking" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    fireEvent.change(screen.getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "10" },
    });
    const preview = await screen.findByRole("status", { name: "" });
    expect(
      within(preview).getByText("Position #1 will have 110 STATICS staked.")
    ).toBeInTheDocument();
    expect(
      within(preview).getByText(/STATICS: added stake is estimated to start earning from/)
    ).toBeInTheDocument();
    expect(
      within(preview).getByText(/Restarts Position #1's allocation cooldown/)
    ).toBeInTheDocument();
  });
  it("creates a position and stakes with the chosen reward assets in one transaction", async () => {
    // The receipt carries the new Position ID; the indexer lags one refresh behind it.
    mocks.execute.mockImplementation(async (request) => {
      if (request.kind === "phase-one-create-position") {
        await request.verifyConfirmation?.({
          logs: [
            {
              address: phaseOne.contracts.diamond,
              topics: encodeEventTopics({
                abi: phaseOneStaticsAbi,
                eventName: "StakingPositionCreated",
                args: { positionId: 2n, owner: wallet },
              }),
              data: encodeAbiParameters([{ type: "uint256" }], [parseEther("25")]),
            },
          ],
        });
        const page = (items: ReturnType<typeof position>[]) => ({
          deploymentId: "phase-one-fixture",
          indexedAtBlock: 1n,
          items,
          nextCursor: null,
        });
        mocks.page
          .mockResolvedValueOnce(page([position(1n)]))
          .mockResolvedValue(page([position(1n), position(2n)]));
      }
      return hash("f");
    });
    withPhaseOne(<RewardsPage earnView="staking" />);
    fireEvent.click(await screen.findByRole("radio", { name: /New position/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    fireEvent.change(screen.getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "25" },
    });
    // The modal defaults to the reward assets of the largest existing position.
    fireEvent.click(screen.getByRole("button", { name: "Reward assets for New position" }));
    const modal = await screen.findByRole("dialog", { name: "Reward assets · new position" });
    expect(within(modal).getByRole("checkbox", { name: /^STATICS/ })).toBeChecked();
    expect(within(modal).getByText("1 of 10 selected")).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole("checkbox", { name: /^WETH/ }));
    fireEvent.click(within(modal).getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reward assets for New position" })
    ).toHaveTextContent("Assets 2/10");
    fireEvent.click(screen.getByRole("button", { name: "Review stake" }));
    const review = await screen.findByRole("dialog", { name: "Create position and stake" });
    expect(within(review).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(within(review).getByRole("button", { name: "Close" })).toBeEnabled();
    fireEvent.click(within(review).getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled());
    const sent = mocks.execute.mock.calls.at(-1)![0];
    expect(sent.kind).toBe("phase-one-create-position");
    expect(sent.value).toBe(1n);
    const decoded = decodeFunctionData({ abi: phaseOneStaticsAbi, data: sent.data });
    expect(decoded.functionName).toBe("createAndStake");
    expect(decoded.args).toEqual([
      parseEther("25"),
      wallet,
      [tokens[0].address, tokens[1].address],
    ]);
    // No reload needed: the new position appears and is selected once indexed.
    expect(
      await screen.findByRole("radio", { name: /Position #2/ }, { timeout: 5_000 })
    ).toBeChecked();
    expect(screen.getByText("Create position and stake confirmed.")).toBeInTheDocument();
  });
  it("updates an existing position's reward assets from the Assets modal", async () => {
    withPhaseOne(<RewardsPage earnView="staking" />);
    const open = await screen.findByRole("button", { name: "Reward assets for Position #1" });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    const modal = await screen.findByRole("dialog", { name: "Reward assets · Position #1" });
    fireEvent.click(within(modal).getByRole("checkbox", { name: /^WETH/ }));
    fireEvent.click(within(modal).getByRole("button", { name: "Cancel" }));
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.click(open);
    const reopened = await screen.findByRole("dialog", { name: "Reward assets · Position #1" });
    // Cancel discarded the draft.
    expect(within(reopened).getByRole("checkbox", { name: /^WETH/ })).not.toBeChecked();
    const search = within(reopened).getByRole("searchbox", { name: "Search reward assets" });
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(within(reopened).getByText("No assets match your search.")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "we" } });
    expect(within(reopened).getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.click(within(reopened).getByRole("checkbox", { name: /^WETH/ }));
    // Clearing the search keeps the existing selection that was hidden by it.
    fireEvent.change(search, { target: { value: "" } });
    expect(within(reopened).getByRole("checkbox", { name: /^STATICS/ })).toBeChecked();
    fireEvent.click(within(reopened).getByRole("button", { name: "OK" }));
    const review = await screen.findByRole("dialog", {
      name: "Update reward assets for Position #1",
    });
    expect(within(review).getByText("+ WETH")).toBeInTheDocument();
    expect(within(review).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(within(review).getByRole("button", { name: "Close" })).toBeEnabled();
    fireEvent.click(within(review).getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    const sent = mocks.execute.mock.calls[0][0];
    expect(sent.kind).toBe("phase-one-reward-selection");
    const decoded = decodeFunctionData({ abi: phaseOneStaticsAbi, data: sent.data });
    expect(decoded.functionName).toBe("optInRewardAssets");
    expect(decoded.args).toEqual([1n, [tokens[1].address]]);
  });
});

describe("Earn review remediation", () => {
  it("keeps overview Collect wallet-wide even when the URL contains pool or asset filters", async () => {
    mocks.params = new URLSearchParams(`poolId=${hash("2")}&asset=${tokens[1].address}`);
    withPhaseOne(<RewardsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Collect" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const decoded = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls[0][0].data,
    });
    expect(decoded.args?.[0]).toHaveLength(1);
    expect(decoded.args?.[1]).toHaveLength(1);
    expect(decoded.args?.[2]).toHaveLength(2);
  });
  it("preserves malformed legacy filters until an explicit reset", async () => {
    mocks.params = new URLSearchParams("positionId=bad");
    withPhaseOne(<RewardsPage />);
    await screen.findByText("These filters are invalid or unavailable for this wallet.");
    expect(mocks.replace).toHaveBeenCalledWith("/app/rewards/staking?positionId=bad");
    expect(screen.queryByRole("region", { name: "Position management" })).not.toBeInTheDocument();
  });
  it("selected rewards remain claimable when an unselected pool fails", async () => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "positionGaugePools"
        ? [[hash("1"), hash("2")], 2n]
        : input.functionName === "previewLpRewards" && input.args[1] === hash("2")
          ? Promise.reject(Error("pool unavailable"))
          : original(input)
    );
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await screen.findByText(/Some data could not be loaded/);
    expect(screen.getByRole("button", { name: "Collect" })).toBeDisabled();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Select all positions in STATICS / WETH" })
    );
    expect(screen.getByRole("button", { name: "Collect selected" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Collect selected" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
  });
  it("shows range status, share and the emission estimate per pool", async () => {
    const original = mocks.read.getMockImplementation()!;
    let poolWeight = 50n;
    mocks.read.mockImplementation((input) => {
      if (input.functionName === "gaugeReserve")
        return {
          activated: true,
          periodBudget: parseEther("700"),
          totalAllocatedWeight: 100n,
          periodFinish: 3000 + 7_200,
        };
      if (input.functionName === "gaugePool")
        return { stopped: false, referenceTick: 0, activeGaugeLiquidity: 1_000n };
      if (input.functionName === "gaugePoolWeight") return { weight: poolWeight, stale: false };
      if (input.functionName === "lpLeg") return { liquidity: 250n, tickLower: -60, tickUpper: 60 };
      return original(input);
    });
    const view = withPhaseOne(<RewardsPage earnView="gauge" />);
    const row = (
      await screen.findByTitle("At least one of your ranges contains the current price.")
    ).closest("tr")!;
    // 700 × 50/100 to the pool; 250 of 1,000 active liquidity is a 25% share.
    expect(within(row).getByText("25%")).toBeInTheDocument();
    expect(within(row).getByText("350")).toBeInTheDocument();
    expect(within(row).getByText("87.5")).toBeInTheDocument();
    expect(screen.getByText("Current period ends in 2h 0m")).toBeInTheDocument();
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    view.unmount();
    // Zero allocation weight: in range, but the pool receives no emissions.
    poolWeight = 0n;
    withPhaseOne(<RewardsPage earnView="gauge" />);
    const idle = (await screen.findByTitle(/This pool has no active protocol emissions/)).closest(
      "tr"
    )!;
    // The attention chip filters to every reason, not only out-of-range pools.
    fireEvent.click(screen.getByRole("button", { name: "Show 1 pools that need attention" }));
    expect(screen.getByRole("button", { name: /^Needs attention/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTitle(/This pool has no active protocol emissions/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Earning/ }));
    expect(
      screen.queryByTitle(/This pool has no active protocol emissions/)
    ).not.toBeInTheDocument();
    expect(within(idle).getByRole("link", { name: "Allocate" })).toHaveAttribute(
      "href",
      expect.stringContaining("/app/rewards/allocations?positionId=1&poolId=")
    );
  });
  it("shows weight share, directed emissions and weekly incentives per allocated pool", async () => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "gaugePositionAllocations"
        ? [
            0,
            parseEther("10"),
            [{ poolId: hash("1"), amount: parseEther("10"), eligibilityVersion: currentVersion }],
            parseEther("10"),
          ]
        : original(input)
    );
    mocks.directory.mockImplementation(async ({ filters }) =>
      directoryPage(filters?.search === hash("1") ? [directoryPool(hash("1"))] : [])
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    const row = (await screen.findByTitle(/Counts toward this pool's weight/)).closest("tr")!;
    // 10 of 100 pool weight; 700 budget × 10 / 200 total weight; 14 WETH over two weeks → 7
    // this week × 10%.
    expect(within(row).getByText("10%")).toBeInTheDocument();
    expect(within(row).getByText("35 STATICS")).toBeInTheDocument();
    expect(within(row).getByText("0.7")).toBeInTheDocument();
  });
  it("flags a stale allocation and moves it to the suggested pool in one transaction", async () => {
    const stopped = directoryPool(hash("2"), {
      eligibility: { eligible: false, reasons: ["gauge-stopped"] },
      gaugeStopped: true,
      incentiveStreamCount: 0,
      allocatorStreams: [],
    });
    const candidates = [
      directoryPool(hash("1")),
      directoryPool(hash("4"), {
        token0: { address: tokens[2].address, symbol: "TOKEN", name: "Token", decimals: 18 },
        incentiveStreamCount: 3,
      }),
    ];
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "gaugePositionAllocations"
        ? [
            0,
            parseEther("30"),
            [
              { poolId: hash("1"), amount: parseEther("10"), eligibilityVersion: currentVersion },
              { poolId: hash("2"), amount: parseEther("20"), eligibilityVersion: currentVersion },
            ],
            parseEther("10"),
          ]
        : original(input)
    );
    mocks.directory.mockImplementation(async ({ filters }) =>
      directoryPage(
        filters?.search === hash("1")
          ? [candidates[0]]
          : filters?.search === hash("2")
            ? [stopped]
            : filters?.search
              ? []
              : candidates
      )
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    const stale = (await screen.findByTitle(/This allocation no longer counts/)).closest("tr")!;
    // Pool 1 is already in this position's set, so it beats the more incentivised pool 4.
    expect(
      within(stale).getByText(
        "Gauge stopped · Suggested: STATICS / WETH (already in this position's pools)"
      )
    ).toBeInTheDocument();
    // Move stages the suggested pool with this position's stake there plus its stale stake.
    fireEvent.click(within(stale).getByRole("button", { name: /^Move the stale allocation in / }));
    const panel = await screen.findByRole("dialog", { name: "Manage allocations" });
    expect(within(panel).getByText("30 STATICS allocated")).toBeInTheDocument();
    expect(within(panel).getByText("Will be dropped")).toBeInTheDocument();
    expect(
      within(panel).getByText("Drops the stale allocation to STATICS / WETH.")
    ).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Add to changes" }));
    const changes = screen.getByRole("region", { name: "Actions for selected allocations" });
    fireEvent.click(within(changes).getByRole("button", { name: "Review changes" }));
    const review = await screen.findByRole("dialog", { name: "Review allocation changes" });
    expect(
      within(review).getByText("Removes the ineligible allocation to STATICS / WETH")
    ).toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled());
    // The live set drops the stopped pool, which the contract would otherwise reject.
    expect(
      decodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        data: mocks.execute.mock.calls.at(-1)![0].data,
      }).args
    ).toEqual([1n, [hash("1")], [parseEther("30")]]);
    fireEvent.click(screen.getByRole("button", { name: "Show 1 pools that need attention" }));
    expect(screen.getByRole("button", { name: /^Needs attention/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByTitle(/Counts toward this pool's weight/)).not.toBeInTheDocument();
    expect(screen.getByTitle(/This allocation no longer counts/)).toBeInTheDocument();
  });
  it("removes a stale-only allocation during cooldown without another eligible pool", async () => {
    mocks.params = new URLSearchParams(`positionId=1&poolId=${hash("2")}`);
    const stopped = directoryPool(hash("2"), {
      eligibility: { eligible: false, reasons: ["gauge-stopped"] },
      gaugeStopped: true,
      incentiveStreamCount: 0,
      allocatorStreams: [],
    });
    mocks.directory.mockImplementation(async ({ filters }) =>
      directoryPage(filters?.search === hash("2") ? [stopped] : [])
    );
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "gaugePositionAllocations"
        ? [
            5_000,
            parseEther("20"),
            [{ poolId: hash("2"), amount: parseEther("20"), eligibilityVersion: currentVersion }],
            0n,
          ]
        : original(input)
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    await screen.findByTitle(/This allocation no longer counts/);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Position #1 allocation to STATICS / WETH",
      })
    );
    const editor = await screen.findByRole("dialog", { name: "Manage allocations" });
    expect(within(editor).getByRole("button", { name: "Clear all" })).toBeEnabled();
    fireEvent.click(
      within(editor).getByRole("button", {
        name: "Remove from STATICS / WETH on Position #1",
      })
    );
    expect(within(editor).getByRole("button", { name: "Add to changes" })).toBeEnabled();
    fireEvent.click(within(editor).getByRole("button", { name: "Add to changes" }));
    const changes = screen.getByRole("region", { name: "Actions for selected allocations" });
    fireEvent.click(within(changes).getByRole("button", { name: "Review changes" }));
    const review = await screen.findByRole("dialog", { name: "Review allocation changes" });
    fireEvent.click(within(review).getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled());
    expect(
      decodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        data: mocks.execute.mock.calls.at(-1)![0].data,
      }).args
    ).toEqual([1n, [], []]);
  });
  it("lists the pool directory with per-1,000 estimates, streams and a preset Allocate", async () => {
    const stopped = directoryPool(hash("5"), {
      eligibility: { eligible: false, reasons: ["gauge-stopped"] },
      gaugeStopped: true,
    });
    mocks.directory.mockImplementation(async ({ filters }) =>
      directoryPage(
        filters?.search
          ? []
          : filters?.eligible === "all"
            ? [directoryPool(hash("1")), stopped]
            : [directoryPool(hash("1"))]
      )
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    await screen.findAllByRole("button", { name: /^Adjust allocation to / });
    fireEvent.click(screen.getByRole("button", { name: "Browse pools" }));
    const directory = () => screen.getByRole("dialog", { name: "Pool directory" });
    // 7 WETH this week; a new 1,000 STATICS joins 100 of weight → 7 × 1,000 / 1,100.
    await waitFor(() => expect(within(directory()).getByText("6.363636 WETH")).toBeInTheDocument());
    expect(within(directory()).getByText("1 pool")).toBeInTheDocument();
    fireEvent.click(
      within(directory()).getByRole("button", { name: "Show incentive streams in STATICS / WETH" })
    );
    expect(
      within(directory()).getByRole("list", {
        name: "Allocator incentive streams in STATICS / WETH",
      })
    ).toHaveTextContent("50% to allocators");
    fireEvent.click(within(directory()).getByRole("button", { name: "Include ineligible" }));
    await waitFor(() =>
      expect(
        within(directory()).getAllByRole("button", { name: "Allocate to STATICS / WETH" })
      ).toHaveLength(2)
    );
    const [open, closed] = within(directory()).getAllByRole("button", {
      name: "Allocate to STATICS / WETH",
    });
    expect(closed).toBeDisabled();
    expect(closed).toHaveAttribute("title", "This pool is not eligible for allocations.");
    await waitFor(() => expect(open).toBeEnabled());
    // Browsers focus a clicked button; the dialog returns focus there when it closes.
    open.focus();
    fireEvent.click(open);
    const panel = await screen.findByRole("dialog", { name: "Manage allocations" });
    const input = within(panel).getByRole("textbox", {
      name: "Amount to add to or remove from STATICS / WETH, Position #1",
    });
    expect(within(panel).getByText("10 STATICS allocated")).toBeInTheDocument();
    // The allocation dialog stacks over the directory: Escape closes only the top dialog and
    // focus returns to the Allocate control that opened it.
    expect(directory()).not.toBe(panel);
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Manage allocations" })).not.toBeInTheDocument()
    );
    expect(directory()).toBeInTheDocument();
    expect(open).toHaveFocus();
    // Staging returns to the directory, which shows the change set at its foot.
    fireEvent.click(open);
    const again = await screen.findByRole("dialog", { name: "Manage allocations" });
    fireEvent.change(
      within(again).getByRole("textbox", {
        name: "Amount to add to or remove from STATICS / WETH, Position #1",
      }),
      { target: { value: "5" } }
    );
    fireEvent.click(
      within(again).getByRole("button", { name: "Remove from STATICS / WETH on Position #1" })
    );
    fireEvent.click(within(again).getByRole("button", { name: "Add to changes" }));
    expect(within(directory()).getByText("1 position · 1 transaction")).toBeInTheDocument();
    expect(
      within(directory()).getByRole("button", { name: "Show incentive streams in STATICS / WETH" })
    ).toBeInTheDocument();
    fireEvent.keyDown(directory(), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Pool directory" })).not.toBeInTheDocument()
    );
    expect(
      within(screen.getByRole("region", { name: "Actions for selected allocations" })).getByText(
        "1 position · 1 transaction"
      )
    ).toBeInTheDocument();
  });
  it("marks an expired indexed incentive as ended using the chain clock", async () => {
    const observed = directoryPool(hash("1"));
    mocks.directory.mockResolvedValue(
      directoryPage([
        directoryPool(hash("1"), {
          allocatorStreams: [{ ...observed.allocatorStreams[0], periodFinish: 2_000n }],
        }),
      ])
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    fireEvent.click(screen.getByRole("button", { name: "Browse pools" }));
    const directory = await screen.findByRole("dialog", { name: "Pool directory" });
    expect(within(directory).queryByText(/6\.363636 WETH/)).not.toBeInTheDocument();
    fireEvent.click(
      await within(directory).findByRole("button", {
        name: "Show incentive streams in STATICS / WETH",
      })
    );
    expect(
      within(directory).getByRole("list", {
        name: "Allocator incentive streams in STATICS / WETH",
      })
    ).toHaveTextContent("Ended");
    expect(within(directory).queryByText("Active")).not.toBeInTheDocument();
  });
  it("searches the directory in the indexer and restarts after a mid-paging change", async () => {
    let page = 0;
    mocks.directory.mockImplementation(async ({ filters }) => {
      if (filters?.search?.startsWith("0x")) return directoryPage([]);
      if (filters?.cursor) throw new AllocationDirectoryChangedError();
      page += 1;
      return {
        ...directoryPage([directoryPool(hash(String(page)))]),
        nextCursor: "next",
        total: 2,
      };
    });
    withPhaseOne(<RewardsPage earnView="allocations" />);
    await screen.findAllByRole("button", { name: /^Adjust allocation to / });
    fireEvent.click(screen.getByRole("button", { name: "Browse pools" }));
    const directory = () => screen.getByRole("dialog", { name: "Pool directory" });
    const more = await within(directory()).findByRole("button", { name: "Load more · 1" });
    await waitFor(() => expect(more).toBeEnabled());
    fireEvent.click(more);
    await waitFor(() =>
      expect(mocks.directory.mock.calls.some(([input]) => input.filters?.cursor === "next")).toBe(
        true
      )
    );
    expect(await within(directory()).findByText(/The directory changed/)).toBeInTheDocument();
    fireEvent.click(within(directory()).getByRole("button", { name: "Restart list" }));
    await waitFor(() =>
      expect(within(directory()).queryByText(/The directory changed/)).not.toBeInTheDocument()
    );
    fireEvent.change(within(directory()).getByRole("searchbox", { name: "Search pools" }), {
      target: { value: "WETH" },
    });
    await waitFor(() =>
      expect(mocks.directory.mock.calls.some(([input]) => input.filters?.search === "WETH")).toBe(
        true
      )
    );
  });
  it("only lets a position in cooldown reduce its allocation", async () => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "gaugePositionAllocations"
        ? [
            5_000,
            parseEther("10"),
            [{ poolId: hash("1"), amount: parseEther("10"), eligibilityVersion: currentVersion }],
            parseEther("10"),
          ]
        : original(input)
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    fireEvent.click((await screen.findAllByRole("button", { name: /^Adjust allocation to / }))[0]);
    const panel = await screen.findByRole("dialog", { name: "Manage allocations" });
    const input = within(panel).getByRole("textbox", {
      name: "Amount to add to or remove from STATICS / WETH, Position #1",
    });
    const add = within(panel).getByRole("button", { name: "Add to STATICS / WETH on Position #1" }),
      remove = within(panel).getByRole("button", {
        name: "Remove from STATICS / WETH on Position #1",
      });
    expect(within(panel).getByText(/^Reduce-only until/)).toBeInTheDocument();
    expect(within(panel).getByRole("searchbox", { name: "Add a pool" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "2" } });
    expect(add).toBeDisabled();
    expect(remove).toBeEnabled();
    expect(
      within(panel).getByText(/^Reduce-only until .*: you can remove from this pool, but not add/)
    ).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.click(remove);
    expect(within(panel).getByText("6 STATICS allocated")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Add to changes" })).toBeEnabled();
    // During cooldown a reduced pool may go back up, but not past its amount on chain.
    fireEvent.change(input, { target: { value: "5" } });
    expect(add).toBeDisabled();
    fireEvent.change(input, { target: { value: "4" } });
    expect(add).toBeEnabled();
    // A reduction during cooldown leaves the cooldown where it is.
    expect(
      within(panel).getByText(/^Reductions don't extend this position's cooldown/)
    ).toBeInTheDocument();
  });
  it("sends one transaction per position and keeps confirmed ones when stopped", async () => {
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [position(1n), position(2n)],
      nextCursor: null,
    });
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "gaugePositionAllocations"
        ? [
            0,
            parseEther("10"),
            [{ poolId: hash("1"), amount: parseEther("10"), eligibilityVersion: currentVersion }],
            parseEther("10"),
          ]
        : original(input)
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    fireEvent.click((await screen.findAllByRole("button", { name: /^Adjust allocation to / }))[0]);
    const panel = await screen.findByRole("dialog", { name: "Manage allocations" });
    // One position at a time: pick each from the dropdown and clear its allocation.
    for (const id of ["1", "2"]) {
      // Positions are chosen on their own full-screen list.
      fireEvent.click(within(panel).getByRole("button", { name: /^Position #\d+ selected\./ }));
      const picker = await screen.findByRole("dialog", { name: "Choose a position" });
      fireEvent.click(
        within(picker).getByRole("button", { name: new RegExp(`^Position #${id},`) })
      );
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Choose a position" })).not.toBeInTheDocument()
      );
      fireEvent.change(
        within(panel).getByRole("textbox", {
          name: `Amount to add to or remove from STATICS / WETH, Position #${id}`,
        }),
        { target: { value: "10" } }
      );
      fireEvent.click(
        within(panel).getByRole("button", {
          name: `Remove from STATICS / WETH on Position #${id}`,
        })
      );
    }
    fireEvent.click(
      within(panel).getByRole("button", { name: "Position #2 selected. Choose another position" })
    );
    const picker = await screen.findByRole("dialog", { name: "Choose a position" });
    const first = within(picker).getByRole("button", { name: /^Position #1, 1 change, / });
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(within(picker).getByRole("button", { name: /^Position #2,/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.keyDown(picker, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Choose a position" })).not.toBeInTheDocument()
    );
    expect(within(panel).getByText("2 positions changed")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Add to changes" }));
    const changes = () => screen.getByRole("region", { name: "Actions for selected allocations" });
    expect(within(changes()).getByText("2 positions · 2 transactions")).toBeInTheDocument();
    // Ask to stop while the first transaction is being sent.
    mocks.execute.mockImplementationOnce(async () => {
      // A real wallet prompt takes time; let the progress and Stop control render first.
      fireEvent.click(await screen.findByRole("button", { name: "Stop after this transaction" }));
      return hash("f");
    });
    fireEvent.click(within(changes()).getByRole("button", { name: "Review changes" }));
    const review = await screen.findByRole("dialog", { name: "Review allocation changes" });
    fireEvent.click(within(review).getByRole("button", { name: "Confirm transaction" }));
    expect(
      await screen.findByText(/^Stopped\. Confirmed positions stay confirmed/)
    ).toBeInTheDocument();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute.mock.calls[0][0].kind).toBe("phase-one-set-allocations");
    // The confirmed position leaves the change set; the other is still staged.
    await waitFor(() =>
      expect(within(changes()).getByText("1 position · 1 transaction")).toBeInTheDocument()
    );
  });
  it("stops between gauge checkpoint prerequisites", async () => {
    mocks.block.mockResolvedValue({ timestamp: 3_000n + 4n * 604_800n });
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) => {
      if (input.functionName === "gaugeReserve")
        return {
          activated: true,
          periodFinish: 3_000,
          lastCheckpoint: 3_000,
          periodBudget: 0n,
          totalAllocatedWeight: 0n,
        };
      if (input.functionName === "maxGaugeCatchupPeriods") return 1;
      return original(input);
    });
    withPhaseOne(<RewardsPage earnView="allocations" />);
    fireEvent.click((await screen.findAllByRole("button", { name: /^Adjust allocation to / }))[0]);
    const editor = await screen.findByRole("dialog", { name: "Manage allocations" });
    fireEvent.click(within(editor).getByRole("button", { name: "Clear all" }));
    fireEvent.click(within(editor).getByRole("button", { name: "Add to changes" }));
    const changes = screen.getByRole("region", { name: "Actions for selected allocations" });
    mocks.execute.mockImplementationOnce(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Stop after this transaction" }));
      return hash("f");
    });
    fireEvent.click(within(changes).getByRole("button", { name: "Review changes" }));
    const review = await screen.findByRole("dialog", { name: "Review allocation changes" });
    fireEvent.click(within(review).getByRole("button", { name: "Confirm transaction" }));
    expect(
      await screen.findByText(/^Stopped\. Confirmed positions stay confirmed/)
    ).toBeInTheDocument();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute.mock.calls[0][0].kind).toBe("phase-one-checkpoint-schedule");
  });
  it("opens the editor pre-filled to free an unstake shortfall and reviews it directly", async () => {
    mocks.params = new URLSearchParams(`positionId=1&unlock=${parseEther("15")}`);
    withPhaseOne(<RewardsPage earnView="allocations" />);
    const editor = await screen.findByRole("dialog", { name: "Manage allocations" });
    await waitFor(() =>
      expect(within(editor).getByText(/^Pre-filled to free 15 STATICS/)).toBeInTheDocument()
    );
    // The largest allocation (20 to pool 2) gives up the 15.
    expect(within(editor).getByText("10 STATICS allocated")).toBeInTheDocument();
    expect(within(editor).getByText("5 STATICS allocated")).toBeInTheDocument();
    expect(within(editor).getByText(/15 STATICS becomes free to unstake/)).toBeInTheDocument();
    await waitFor(() =>
      expect(within(editor).getByRole("button", { name: "Add & review" })).toBeEnabled()
    );
    fireEvent.click(within(editor).getByRole("button", { name: "Add & review" }));
    const review = await screen.findByRole("dialog", { name: "Review allocation changes" });
    expect(within(review).getByText(/^Position #1: .* 20 → 5$/)).toBeInTheDocument();
  });
  it("adds a pool from the editor's search and shows it in the stake split", async () => {
    const extra = directoryPool(hash("4"), {
      token0: { address: tokens[2].address, symbol: "TOKEN", name: "Token", decimals: 18 },
    });
    mocks.directory.mockImplementation(async ({ filters }) =>
      directoryPage(
        filters?.search?.startsWith("0x")
          ? filters.search === hash("4")
            ? [extra]
            : [directoryPool(filters.search as `0x${string}`)]
          : [extra]
      )
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    fireEvent.click((await screen.findAllByRole("button", { name: /^Adjust allocation to / }))[0]);
    const editor = await screen.findByRole("dialog", { name: "Manage allocations" });
    fireEvent.click(await within(editor).findByRole("button", { name: "+ TOKEN / WETH" }));
    const input = within(editor).getByRole("textbox", {
      name: "Amount to add to or remove from TOKEN / WETH, Position #1",
    });
    const add = within(editor).getByRole("button", { name: "Add to TOKEN / WETH on Position #1" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(add);
    expect(within(editor).getByText(/^Locked: 30 → 35 STATICS\./)).toBeInTheDocument();
    expect(within(editor).getByRole("img", { name: /TOKEN \/ WETH 5%/ })).toBeInTheDocument();
    // Phones summarise the impact in one footer line that expands to the full list.
    const summary = within(editor).getByRole("button", {
      name: /^Locked 30 → 35 · Starts cooldown/,
    });
    expect(summary).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(summary);
    expect(summary).toHaveAttribute("aria-expanded", "true");
    expect(within(editor).getAllByText(/^Locked: 30 → 35 STATICS\./)).toHaveLength(2);
    // In % of stake, 5 adds 5% of this position's 100 STATICS.
    fireEvent.click(within(editor).getByRole("button", { name: "% of stake" }));
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(add);
    expect(within(input.closest("li")!).getByText("10 STATICS allocated")).toBeInTheDocument();
    // Max inside the box fills what can still be added: 100 staked − 30 elsewhere − 10 here.
    fireEvent.click(
      within(editor).getByRole("button", {
        name: "Fill the most you can add to or remove from TOKEN / WETH",
      })
    );
    expect(input).toHaveValue("60");
    // Switching units clears an amount typed in the other unit.
    fireEvent.click(within(editor).getByRole("button", { name: "STATICS" }));
    expect(input).toHaveValue("");
    fireEvent.click(within(editor).getByRole("button", { name: "Add to changes" }));
    expect(
      within(screen.getByRole("region", { name: "Actions for selected allocations" })).getByText(
        "1 position · 1 transaction"
      )
    ).toBeInTheDocument();
  });
  it("adds a pool from its own screen on phones and returns to that pool's amount", async () => {
    const extra = directoryPool(hash("4"), {
      token0: { address: tokens[2].address, symbol: "TOKEN", name: "Token", decimals: 18 },
    });
    mocks.directory.mockImplementation(async ({ filters }) =>
      directoryPage(
        filters?.search?.startsWith("0x")
          ? filters.search === hash("4")
            ? [extra]
            : [directoryPool(filters.search as `0x${string}`)]
          : [extra]
      )
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    fireEvent.click((await screen.findAllByRole("button", { name: /^Adjust allocation to / }))[0]);
    const editor = await screen.findByRole("dialog", { name: "Manage allocations" });
    fireEvent.click(within(editor).getByRole("button", { name: "+ Add pool" }));
    const picker = await screen.findByRole("dialog", { name: "Add a pool to Position #1" });
    expect(within(picker).getByRole("searchbox", { name: "Add a pool" })).toHaveFocus();
    fireEvent.click(await within(picker).findByRole("button", { name: "+ TOKEN / WETH" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add a pool to Position #1" })
      ).not.toBeInTheDocument()
    );
    expect(
      within(editor).getByRole("textbox", {
        name: "Amount to add to or remove from TOKEN / WETH, Position #1",
      })
    ).toHaveFocus();
  });
  it("keeps retained allocation pools valid when absent from enabled manifests", async () => {
    mocks.params = new URLSearchParams(`poolId=${hash("3")}`);
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "gaugePositionAllocations"
        ? [
            0,
            parseEther("30"),
            [{ poolId: hash("3"), amount: parseEther("30"), eligibilityVersion: currentVersion }],
            parseEther("30"),
          ]
        : original(input)
    );
    mocks.directory.mockImplementation(async ({ filters }) =>
      directoryPage(filters?.search === hash("3") ? [directoryPool(hash("3"))] : [])
    );
    withPhaseOne(<RewardsPage earnView="allocations" />);
    const row = (await screen.findByTitle(/Counts toward this pool's weight/)).closest("tr")!;
    expect(within(row).getByText("30 STATICS")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reset filters" })).not.toBeInTheDocument();
  });
});

it("returns unsupported feature routes to the existing Earn screen", async () => {
  const legacy = { ...option, phaseOne: undefined };
  render(
    <DeploymentContext.Provider
      value={{ active: legacy, options: [legacy], selectNetwork: vi.fn() }}
    >
      <WalletContext.Provider value={defaultWalletState}>
        <RewardsPage earnView="gauge" />
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/app/rewards"));
  expect(mocks.read).not.toHaveBeenCalled();
});

it("does not report an unowned position before the wallet and ownership load", () => {
  mocks.params = new URLSearchParams("positionId=1");
  render(
    <DeploymentContext.Provider
      value={{ active: option, options: [option], selectNetwork: vi.fn() }}
    >
      <WalletContext.Provider value={{ ...defaultWalletState, status: "loading" }}>
        <RewardsPage earnView="staking" />
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
  expect(
    screen.queryByText("This position is missing or belongs to another wallet.")
  ).not.toBeInTheDocument();
  expect(mocks.page).not.toHaveBeenCalled();
});
it("shows position creation for an empty wallet without perpetual reward loading", async () => {
  mocks.page.mockResolvedValue({
    deploymentId: "phase-one-fixture",
    indexedAtBlock: 1n,
    items: [],
    nextCursor: null,
  });
  withPhaseOne(<RewardsPage earnView="staking" />);
  // An empty wallet can create a position and stake in one step.
  expect(await screen.findByRole("radio", { name: /New position/ })).toBeChecked();
  expect(screen.queryByText("Loading your positions and rewards…")).not.toBeInTheDocument();
});

function reviewTree() {
  return (
    <DeploymentContext.Provider
      value={{ active: option, options: [option], selectNetwork: vi.fn() }}
    >
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "ready",
          address: wallet,
          chainId: 31337,
          isTargetChain: true,
        }}
      >
        <RewardsPage earnView="staking" />
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
}
describe("additional review regressions", () => {
  it("uses the timing getter once per selected asset and caches capability across positions", async () => {
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [position(1n), position(2n)],
      nextCursor: null,
    });
    const base = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "rewardSelectionWithTiming"
        ? Promise.resolve([{ pendingStake: parseEther("100"), eligibleAt: 90_000n }, 1_000])
        : base(input)
    );
    withPhaseOne(<RewardsPage earnView="staking" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    fireEvent.change(screen.getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "37" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Review stake" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Review stake" }));
    const dialog = await screen.findByRole("dialog", { name: "Stake into Position #1" });
    expect(within(dialog).getByText(/weighted maturity is estimated/).textContent).not.toContain(
      " – "
    );
    expect(
      mocks.read.mock.calls.filter(([input]) => input.functionName === "rewardSelectionWithTiming")
    ).toHaveLength(2);
    expect(mocks.read.mock.calls.some(([input]) => input.functionName === "rewardSelection")).toBe(
      false
    );
    expect(
      mocks.read.mock.calls.filter(([input]) => input.functionName === "supportsInterface")
    ).toHaveLength(1);
  });
  it("retains staking on an older diamond without the timing interface", async () => {
    const base = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "supportsInterface" ? Promise.resolve(false) : base(input)
    );
    withPhaseOne(<RewardsPage earnView="staking" />);
    await waitFor(() =>
      expect(
        mocks.read.mock.calls.some(([input]) => input.functionName === "rewardSelection")
      ).toBe(true)
    );
    fireEvent.change(screen.getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "1" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Review stake" })).toBeEnabled());
    expect(
      mocks.read.mock.calls.some(([input]) => input.functionName === "rewardSelectionWithTiming")
    ).toBe(false);
  });
  it("does not conceal a failed supported getter by estimating from the legacy view", async () => {
    const base = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "rewardSelectionWithTiming"
        ? Promise.reject(Error("RPC failed"))
        : base(input)
    );
    withPhaseOne(<RewardsPage earnView="staking" />);
    await waitFor(() =>
      expect(
        mocks.read.mock.calls.some(([input]) => input.functionName === "rewardSelectionWithTiming")
      ).toBe(true)
    );
    fireEvent.change(screen.getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "1" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Review stake" })).toBeDisabled()
    );
    expect(mocks.read.mock.calls.some(([input]) => input.functionName === "rewardSelection")).toBe(
      false
    );
  });
  it("clears a pending review when the requested position URL changes", async () => {
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [position(1n), position(2n)],
      nextCursor: null,
    });
    const view = render(reviewTree());
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", { name: /Position #2/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review stake" }));
    await screen.findByRole("dialog", { name: "Stake into Position #2" });
    mocks.params = new URLSearchParams("positionId=1");
    view.rerender(reviewTree());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Position #1/ })).toBeChecked();
  });
  it("disables unstake review when the allocation read failed", async () => {
    const base = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "gaugePositionAllocations"
        ? Promise.reject(Error("RPC failed"))
        : base(input)
    );
    withPhaseOne(<RewardsPage earnView="staking" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Unstake" }));
    fireEvent.change(screen.getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "1" },
    });
    expect(screen.getByRole("button", { name: "Review unstake" })).toBeDisabled();
  });
  it("does not silently change the reviewed creation fee", async () => {
    withPhaseOne(<RewardsPage earnView="staking" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", { name: /New position/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review stake" }));
    const dialog = await screen.findByRole("dialog", { name: "Create position and stake" });
    const base = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "positionCreationFee" ? Promise.resolve(2n) : base(input)
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm transaction" }));
    expect(
      await screen.findByText("The position creation fee changed. Review the action again.")
    ).toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("does not load undisplayed wallet reward totals on the management-only staking form", async () => {
    withPhaseOne(<RewardsPage earnView="staking" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    expect(mocks.read.mock.calls.some(([input]) => input.functionName === "pendingRewards")).toBe(
      false
    );
  });
});

it("keeps legacy unlisted reward-asset links usable on the management-only staking screen", async () => {
  mocks.params = new URLSearchParams(`positionId=1&asset=${address("a")}&poolId=${hash("c")}`);
  withPhaseOne(<RewardsPage earnView="staking" />);
  expect(await screen.findByRole("radio", { name: /Position #1/ })).toBeChecked();
  expect(screen.queryByRole("link", { name: "Reset filters" })).not.toBeInTheDocument();
});

describe("liquidity claim scope regressions", () => {
  it.each(["Collect", "Collect selected"])(
    "honors the requested reward asset in %s",
    async (label) => {
      mocks.params = new URLSearchParams(`asset=${tokens[1].address}`);
      withPhaseOne(<RewardsPage earnView="gauge" />);
      await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
      if (label === "Collect selected")
        fireEvent.click(
          screen.getByRole("checkbox", { name: "Select all positions in STATICS / WETH" })
        );
      fireEvent.click(screen.getByRole("button", { name: label }));
      await screen.findByRole("button", { name: "Confirm transaction" });
      const decoded = decodeFunctionData({
        abi: staticsBatchRewardsAbi,
        data: mocks.call.mock.calls[0][0].data,
      });
      expect(decoded.args?.[1]).toMatchObject([{ positionId: 1n, slots: [1] }]);
    }
  );
  it("clears selected legs when search hides them", async () => {
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all positions in STATICS / WETH" })
    );
    expect(
      screen.getByRole("region", { name: "Actions for selected liquidity" })
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search pools" }), {
      target: { value: "nothing matches" },
    });
    expect(
      screen.queryByRole("region", { name: "Actions for selected liquidity" })
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search pools" }), {
      target: { value: "" },
    });
    expect(
      screen.getByRole("checkbox", { name: "Select all positions in STATICS / WETH" })
    ).not.toBeChecked();
  });
});

function gaugeReviewTree() {
  return (
    <DeploymentContext.Provider
      value={{ active: option, options: [option], selectNetwork: vi.fn() }}
    >
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "ready",
          address: wallet,
          chainId: 31337,
          isTargetChain: true,
        }}
      >
        <RewardsPage earnView="gauge" />
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
}
it("updates pool search when the URL pool changes", async () => {
  const base = mocks.read.getMockImplementation()!;
  mocks.read.mockImplementation((input) =>
    input.functionName === "positionGaugePools"
      ? Promise.resolve([[hash("1"), hash("2")], 2n])
      : base(input)
  );
  mocks.params = new URLSearchParams(`poolId=${hash("1")}`);
  const view = render(gaugeReviewTree());
  await waitFor(() =>
    expect(screen.getByRole("searchbox", { name: "Search pools" })).toHaveValue("STATICS / WETH")
  );
  mocks.params = new URLSearchParams(`poolId=${hash("2")}`);
  view.rerender(gaugeReviewTree());
  await waitFor(() =>
    expect(
      mocks.read.mock.calls.some(
        ([input]) => input.functionName === "previewLpRewards" && input.args[1] === hash("2")
      )
    ).toBe(true)
  );
  expect(screen.getByRole("searchbox", { name: "Search pools" })).toHaveValue("STATICS / TOKEN");
});

it("clears a liquidity claim review when the status filter changes", async () => {
  withPhaseOne(<RewardsPage earnView="gauge" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Collect" }));
  await screen.findByRole("button", { name: "Confirm transaction" });
  fireEvent.click(screen.getByRole("button", { name: /^Needs attention/ }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mocks.execute).not.toHaveBeenCalled();
});

it("reuses the reward discovery LP leg for range presentation", async () => {
  withPhaseOne(<RewardsPage earnView="gauge" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
  await screen.findByText("No liquidity");
  expect(mocks.read.mock.calls.filter(([input]) => input.functionName === "lpLeg")).toHaveLength(1);
});

it.each([false, true])(
  "shows no emissions for an inactive or empty reserve (activated=%s)",
  async (activated) => {
    const base = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) => {
      if (input.functionName === "gaugeReserve")
        return {
          activated,
          periodBudget: activated ? 0n : parseEther("700"),
          totalAllocatedWeight: 100n,
          periodFinish: 10_000,
        };
      if (input.functionName === "gaugePool")
        return { stopped: false, referenceTick: 0, activeGaugeLiquidity: 1000n };
      if (input.functionName === "gaugePoolWeight") return { weight: 50n, stale: false };
      if (input.functionName === "lpLeg") return { liquidity: 250n, tickLower: -60, tickUpper: 60 };
      return base(input);
    });
    withPhaseOne(<RewardsPage earnView="gauge" />);
    const row = (await screen.findByTitle(/This pool has no active protocol emissions/)).closest(
      "tr"
    )!;
    expect(within(row).getByText("No emissions")).toBeInTheDocument();
    expect(within(row).queryByText("Earning")).not.toBeInTheDocument();
  }
);

it.each(["0", "700"])(
  "does not use an expired %s budget for current status or emissions",
  async (budget) => {
    const base = mocks.read.getMockImplementation()!;
    const simulate = mocks.simulate.getMockImplementation()!;
    mocks.simulate.mockImplementation((input) =>
      input.functionName === "claimLpRewards"
        ? Promise.resolve({ result: [parseEther("1")] })
        : simulate(input)
    );
    mocks.read.mockImplementation((input) => {
      if (input.functionName === "gaugeReserve")
        return {
          activated: true,
          periodBudget: parseEther(budget),
          totalAllocatedWeight: 100n,
          periodFinish: 3000,
        };
      if (input.functionName === "gaugePool")
        return { stopped: false, referenceTick: 0, activeGaugeLiquidity: 1000n };
      if (input.functionName === "gaugePoolWeight") return { weight: 50n, stale: false };
      if (input.functionName === "lpLeg") return { liquidity: 250n, tickLower: -60, tickUpper: 60 };
      return base(input);
    });
    withPhaseOne(<RewardsPage earnView="gauge" />);
    expect(
      await screen.findByText(
        "Current period estimates are unavailable until the reserve is checkpointed."
      )
    ).toBeInTheDocument();
    const poolRow = (
      await screen.findByTitle(
        "Current-period emission data is unavailable. Range information and earned rewards remain available."
      )
    ).closest("tr")!;
    expect(within(poolRow).getByText("Unavailable")).toBeInTheDocument();
    expect(within(poolRow).queryByText("Earning")).not.toBeInTheDocument();
    expect(within(poolRow).queryByText("No emissions")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    expect(screen.queryByText("350")).not.toBeInTheDocument();
    expect(screen.queryByText("87.5")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show positions in STATICS / WETH" }));
    expect(screen.queryByText("87.5")).not.toBeInTheDocument();
  }
);

const cachedLeg = {
  manager: zeroAddress,
  posmTokenId: 1n,
  tickLower: -60,
  tickUpper: 60,
  liquidity: 100n,
  checkpointInsideRay: [0n, 0n, 0n, 0n, 0n],
  rewardRemainderRay: [0n, 0n, 0n, 0n, 0n],
  claimable: [0n, 0n, 0n, 0n, 0n],
} as const;
function cachedLegKey() {
  return liquidityLegQuery({
    publicClient: {} as PublicClient,
    deployment: phaseOne,
    account: wallet.toLowerCase() as Address,
    positionId: 999n,
    poolId: hash("1"),
  }).queryKey;
}

it("refreshes checksummed-wallet leg data through the page Refresh button", async () => {
  let cache: QueryClient | undefined;
  function CacheProbe() {
    cache = useQueryClient();
    return null;
  }
  const base = mocks.read.getMockImplementation()!;
  mocks.read.mockImplementation((input) => {
    if (input.functionName === "positionGaugePools")
      return Promise.resolve([[hash("1"), hash("2")], 2n]);
    if (input.functionName === "previewLpRewards" && input.args[1] === hash("2"))
      return Promise.reject(Error("Rewards unavailable"));
    return base(input);
  });
  withPhaseOne(
    <>
      <CacheProbe />
      <RewardsPage earnView="gauge" />
    </>
  );
  const refresh = await screen.findByRole("button", { name: "Refresh" });
  const key = cachedLegKey();
  cache!.setQueryData(key, cachedLeg);
  expect(cache!.getQueryState(key)?.isInvalidated).toBe(false);
  fireEvent.click(refresh);
  await waitFor(() => expect(cache!.getQueryState(key)?.isInvalidated).toBe(true));
});

it("refreshes checksummed-wallet leg data after the stake form confirms", async () => {
  let cache: QueryClient | undefined;
  function CacheProbe() {
    cache = useQueryClient();
    return null;
  }
  withPhaseOne(
    <>
      <CacheProbe />
      <RewardsPage earnView="staking" />
    </>
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
  const key = cachedLegKey();
  cache!.setQueryData(key, cachedLeg);
  fireEvent.change(screen.getByRole("textbox", { name: "STATICS amount" }), {
    target: { value: "1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review stake" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm transaction" }));
  await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(cache!.getQueryState(key)?.isInvalidated).toBe(true));
});

it("shows no claimable rewards after Collect confirms, without a reload", async () => {
  const original = mocks.read.getMockImplementation()!;
  let claimed = false;
  mocks.read.mockImplementation((input) => {
    if (claimed) {
      // Chain state after the claim: nothing left to collect.
      if (input.functionName === "pendingRewards") return [0n];
      if (input.functionName === "previewLpRewards")
        return {
          slotCount: 2,
          assets: [tokens[0].address, tokens[1].address, zeroAddress, zeroAddress, zeroAddress],
          amounts: [0n, 0n, 0n, 0n, 0n],
        };
      if (input.functionName === "previewGaugeAllocatorRewards")
        return input.args[2].map((slot: number) => ({
          slot,
          asset: tokens[1].address,
          allocation: parseEther("10"),
          amount: 0n,
        }));
    }
    return original(input);
  });
  withPhaseOne(
    <>
      <ProtocolQueryReconciler />
      <RewardsPage />
    </>
  );
  const collect = await screen.findByRole("button", { name: "Collect Position #1 rewards" });
  await waitFor(() => expect(collect).toBeEnabled());
  fireEvent.click(collect);
  fireEvent.click(await screen.findByRole("button", { name: "Confirm transaction" }));
  await waitFor(() => expect(mocks.execute).toHaveBeenCalled());
  claimed = true;
  act(() =>
    announceProtocolTransactionConfirmed({
      wallet,
      chainId: 31337,
      deploymentId: "phase-one-fixture",
      blockNumber: 11n,
      kind: "phase-one-claim-batch-rewards",
      scopes: protocolQueryScopes("phase-one-claim-batch-rewards"),
    })
  );
  const row = screen.getByText("Position #1").closest("tr")!;
  expect(await within(row).findByText("No claimable rewards")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Collect Position #1 rewards" })
  ).not.toBeInTheDocument();
  const completed = screen.getByRole("dialog", { name: "Collect Position #1 rewards" });
  expect(within(completed).getByText("All 1 transactions confirmed.")).toBeInTheDocument();
  expect(
    within(completed).getByRole("link", { name: /Transaction 1 confirmed/ })
  ).toBeInTheDocument();
});
it("collects one position from its row and hides positions from the overview table", async () => {
  window.localStorage.clear();
  mocks.page.mockResolvedValue({
    deploymentId: "phase-one-fixture",
    indexedAtBlock: 1n,
    items: [position(1n), position(2n)],
    nextCursor: null,
  });
  withPhaseOne(<RewardsPage />);
  const collectTwo = await screen.findByRole("button", { name: "Collect Position #2 rewards" });
  await waitFor(() => expect(collectTwo).toBeEnabled());
  fireEvent.click(collectTwo);
  await screen.findByRole("button", { name: "Confirm transaction" });
  // Only Position #2 is claimed.
  expect(claimedPositions(mocks.call.mock.calls[0][0].data)).toEqual([2n]);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  const rowTwo = screen.getByText("Position #2").closest("tr")!;
  fireEvent.click(within(rowTwo).getByRole("button", { name: "Hide" }));
  await waitFor(() => expect(screen.queryByText("Position #2")).not.toBeInTheDocument());
  expect(screen.getByText("Position #1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show hidden · 1" }));
  expect(await screen.findByText("Position #2")).toBeInTheDocument();
  window.localStorage.clear();
});
it("collects every pool from the summary, or one pool or position from its row", async () => {
  const poolIds = Array.from(
    { length: 12 },
    (_, index) => `0x${(index + 1).toString(16).padStart(64, "0")}`
  );
  const original = mocks.read.getMockImplementation()!;
  mocks.read.mockImplementation((input) =>
    input.functionName === "positionGaugePools" ? [poolIds, 12n] : original(input)
  );
  withPhaseOne(<RewardsPage earnView="gauge" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Collect" }));
  await screen.findByRole("button", { name: "Confirm transaction" });
  const all = decodeFunctionData({
    abi: staticsBatchRewardsAbi,
    data: mocks.call.mock.calls[0][0].data,
  });
  expect(all.args?.[1]).toHaveLength(12);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  const [poolCollect] = screen.getAllByRole("button", { name: /^Collect .* rewards$/ });
  fireEvent.click(poolCollect);
  await screen.findByRole("button", { name: "Confirm transaction" });
  const one = decodeFunctionData({
    abi: staticsBatchRewardsAbi,
    data: mocks.call.mock.calls.at(-1)![0].data,
  });
  expect(one.args?.[1]).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getAllByRole("button", { name: /^Show positions in/ })[0]);
  expect(
    screen.getAllByRole("button", { name: /^Collect Position #1 rewards in / })[0]
  ).toBeInTheDocument();
});
it("a healthy pool stays claimable from its row when another pool fails", async () => {
  const original = mocks.read.getMockImplementation()!;
  mocks.read.mockImplementation((input) =>
    input.functionName === "positionGaugePools"
      ? [[hash("1"), hash("2")], 2n]
      : input.functionName === "previewLpRewards" && input.args[1] === hash("2")
        ? Promise.reject(Error("pool unavailable"))
        : original(input)
  );
  withPhaseOne(<RewardsPage earnView="gauge" />);
  await screen.findByText(/Some data could not be loaded/);
  expect(screen.getByRole("button", { name: "Collect" })).toBeDisabled();
  // The healthy pool's own Collect is gated only by its own data.
  const healthy = await screen.findByRole("button", { name: "Collect STATICS / WETH rewards" });
  await waitFor(() => expect(healthy).toBeEnabled());
  fireEvent.click(healthy);
  await screen.findByRole("button", { name: "Confirm transaction" });
});
/** Position IDs claimed by a batch reward call, in either the legacy or aggregated format. */
function claimedPositions(data: `0x${string}`): bigint[] {
  const decoded = decodeFunctionData({ abi: staticsBatchRewardsAbi, data });
  const ids = new Set<bigint>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.positionId === "bigint") ids.add(record.positionId);
      Object.values(record).forEach(visit);
    }
  };
  visit(decoded.args);
  return [...ids].sort((a, b) => (a < b ? -1 : 1));
}

it.each(["row", "selected"])(
  "keeps the %s claim receipt after its last LP row disappears",
  async (source) => {
    let claimed = false;
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      claimed && input.functionName === "positionGaugePools"
        ? Promise.resolve([[], 0n])
        : original(input)
    );
    withPhaseOne(
      <>
        <ProtocolQueryReconciler />
        <RewardsPage earnView="gauge" />
      </>
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    const label = source === "row" ? "Collect STATICS / WETH rewards" : "Collect selected";
    if (source === "selected")
      fireEvent.click(
        screen.getByRole("checkbox", { name: "Select all positions in STATICS / WETH" })
      );
    fireEvent.click(screen.getByRole("button", { name: label }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled());
    claimed = true;
    act(() =>
      announceProtocolTransactionConfirmed({
        wallet,
        chainId: 31337,
        deploymentId: "phase-one-fixture",
        blockNumber: 11n,
        kind: "phase-one-claim-batch-rewards",
        scopes: protocolQueryScopes("phase-one-claim-batch-rewards"),
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", { name: "Select all positions in STATICS / WETH" })
      ).not.toBeInTheDocument()
    );
    const dialog = screen.getByRole("dialog", { name: label });
    expect(within(dialog).getByText("All 1 transactions confirmed.")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: /Transaction 1 confirmed/ })
    ).toBeInTheDocument();
  }
);

it("does not reopen a saved row review after filtering away and back", async () => {
  withPhaseOne(<RewardsPage earnView="gauge" />);
  const collect = await screen.findByRole("button", { name: "Collect STATICS / WETH rewards" });
  await waitFor(() => expect(collect).toBeEnabled());
  fireEvent.click(collect);
  await screen.findByRole("button", { name: "Confirm transaction" });
  const search = screen.getByRole("searchbox", { name: "Search pools" });
  fireEvent.change(search, { target: { value: "nothing matches" } });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: "" } });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Collect STATICS / WETH rewards" })).toBeEnabled();
  expect(mocks.call).toHaveBeenCalledTimes(1);
  expect(mocks.execute).not.toHaveBeenCalled();
});

describe("compact liquidity rewards", () => {
  let compact = true;
  let listeners: Set<() => void>;
  beforeEach(() => {
    compact = true;
    listeners = new Set();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        get matches() {
          return compact;
        },
        addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
      }))
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  const resize = (isCompact: boolean) =>
    act(() => {
      compact = isCompact;
      listeners.forEach((listener) => listener());
    });

  it("uses one summary card and opens the other summary metrics in More without extra reads", async () => {
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Estimated emissions this period")).not.toBeInTheDocument();
    const count = mocks.read.mock.calls.length;
    const more = screen.getByRole("button", { name: "More" });
    more.focus();
    fireEvent.click(more);
    const dialog = screen.getByRole("dialog", { name: "Liquidity rewards summary" });
    expect(within(dialog).getByText("Estimated emissions this period")).toBeInTheDocument();
    expect(within(dialog).getByText("Liquidity in range")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /^Show .* pools that need attention$/ })
    ).toBeInTheDocument();
    expect(mocks.read).toHaveBeenCalledTimes(count);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(more);
  });

  it("keeps pool metrics and all actions in the expanded detail while selecting every position in a pool", async () => {
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [position(1n), position(2n)],
      nextCursor: null,
    });
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    expect(
      screen.queryByRole("button", { name: "Collect STATICS / WETH rewards" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Your estimate")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all positions in STATICS / WETH" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Show positions in STATICS / WETH" }));
    expect(
      screen.getByRole("button", { name: "Hide positions in STATICS / WETH" })
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("Your estimate")).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Collect Position #1 rewards in STATICS / WETH" })
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Collect Position #2 rewards in STATICS / WETH" })
    ).toBeEnabled();
    expect(screen.getAllByRole("checkbox", { name: /^Select/ })).toHaveLength(4);
    const poolCollect = screen.getByRole("button", {
      name: "Collect all STATICS / WETH rewards",
    });
    expect(poolCollect).toHaveTextContent("Collect all");
    expect(screen.getAllByRole("link", { name: "Manage" })).toHaveLength(2);
    resize(false);
    const poolRow = screen.getByRole("row", { name: /Select all positions in STATICS/ });
    expect(within(poolRow).queryByRole("link", { name: "Manage" })).not.toBeInTheDocument();
    fireEvent.click(
      within(poolRow).getByRole("button", {
        name: "Collect all STATICS / WETH rewards",
      })
    );
    await screen.findByRole("button", { name: "Confirm transaction" });
    const poolClaim = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls.at(-1)![0].data,
    });
    expect(poolClaim.args?.[1]).toMatchObject([
      { positionId: 1n, poolId: hash("1"), slots: [0, 1] },
      { positionId: 2n, poolId: hash("1"), slots: [0, 1] },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Collect Position #2 rewards in STATICS / WETH",
      })
    );
    await screen.findByRole("button", { name: "Confirm transaction" });
    const positionClaim = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls.at(-1)![0].data,
    });
    expect(positionClaim.args?.[1]).toMatchObject([
      { positionId: 2n, poolId: hash("1"), slots: [0, 1] },
    ]);
    expect(positionClaim.args?.[1]).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Collect selected" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const decoded = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls.at(-1)![0].data,
    });
    expect(decoded.args?.[1]).toMatchObject([
      { positionId: 1n, poolId: hash("1"), slots: [0, 1] },
      { positionId: 2n, poolId: hash("1"), slots: [0, 1] },
    ]);
    expect(decoded.args?.[1]).toHaveLength(2);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "synchronizes individual, pool and header selection (compact=%s)",
    async (isCompact) => {
      mocks.page.mockResolvedValue({
        deploymentId: "phase-one-fixture",
        indexedAtBlock: 1n,
        items: [position(1n), position(2n)],
        nextCursor: null,
      });
      const original = mocks.read.getMockImplementation()!;
      mocks.read.mockImplementation((input) =>
        input.functionName === "positionGaugePools"
          ? input.args[0] === 1n
            ? [[hash("1"), hash("2")], 2n]
            : [[hash("1")], 1n]
          : original(input)
      );
      withPhaseOne(<RewardsPage earnView="gauge" />);
      await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
      resize(isCompact);
      const header = screen.getByRole("checkbox", { name: /^Select all positions$/ });
      fireEvent.click(screen.getByRole("button", { name: "Show positions in STATICS / WETH" }));
      const child = screen.getByRole("checkbox", { name: "Select Position #2 in STATICS / WETH" });
      const pool = screen.getByRole("checkbox", { name: "Select all positions in STATICS / WETH" });
      const otherPool = screen.getByRole("checkbox", {
        name: "Select all positions in STATICS / TOKEN",
      });
      expect(header).not.toBeChecked();
      fireEvent.click(child);
      expect(child).toBeChecked();
      expect(pool).not.toBeChecked();
      expect(pool).toBePartiallyChecked();
      expect(header).toBePartiallyChecked();
      expect(otherPool).not.toBeChecked();
      expect(screen.getByText("1 leg selected")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Collect selected" }));
      await screen.findByRole("button", { name: "Confirm transaction" });
      const decoded = decodeFunctionData({
        abi: staticsBatchRewardsAbi,
        data: mocks.call.mock.calls.at(-1)![0].data,
      });
      expect(decoded.args?.[1]).toHaveLength(1);
      expect(decoded.args?.[1]).toMatchObject([
        { positionId: 2n, poolId: hash("1"), slots: [0, 1] },
      ]);
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      fireEvent.click(header);
      expect(header).toBeChecked();
      expect(pool).toBeChecked();
      expect(otherPool).toBeChecked();
      expect(screen.getByText("3 legs selected")).toBeInTheDocument();
      fireEvent.click(child);
      expect(header).not.toBeChecked();
      expect(header).toBePartiallyChecked();
      expect(pool).not.toBeChecked();
      expect(otherPool).toBeChecked();
      fireEvent.click(child);
      expect(header).toBeChecked();
      expect(pool).toBeChecked();
      fireEvent.click(header);
      expect(header).not.toBePartiallyChecked();
      expect(child).not.toBeChecked();
      expect(otherPool).not.toBeChecked();
      fireEvent.click(pool);
      expect(child).toBeChecked();
      expect(header).toBePartiallyChecked();
      fireEvent.change(screen.getByRole("searchbox", { name: "Search pools" }), {
        target: { value: "WETH" },
      });
      expect(header).not.toBeChecked();
      expect(child).not.toBeChecked();
      fireEvent.click(header);
      expect(header).toBeChecked();
      expect(screen.getByText("2 legs selected")).toBeInTheDocument();
      expect(mocks.execute).not.toHaveBeenCalled();
    }
  );

  it("preserves the frozen claim and expanded pool when switching to desktop", async () => {
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Show positions in STATICS / WETH" }));
    expect(
      screen.getByRole("button", { name: "Collect STATICS / WETH rewards" })
    ).toHaveTextContent("Collect");
    expect(
      screen.queryByRole("button", { name: "Collect all STATICS / WETH rewards" })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Manage" })).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Collect Position #1 rewards in STATICS / WETH" })
    );
    await screen.findByRole("button", { name: "Confirm transaction" });
    resize(false);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide positions in STATICS / WETH" })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("dialog", { name: "Collect Position #1 rewards in STATICS / WETH" })
    ).toBeInTheDocument();
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("shows unavailable range data after a failed read while retaining its claim action", async () => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "gaugePool"
        ? Promise.reject(Error("leg read unavailable"))
        : original(input)
    );
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    await screen.findByText("Some range or emission data could not be loaded.");
    expect(
      screen.getByRole("button", { name: "Show positions in STATICS / WETH" })
    ).toHaveAccessibleDescription("1 position Unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Show positions in STATICS / WETH" }));
    const positionDetail = screen.getByRole("region", { name: "Position #1" });
    expect(within(positionDetail).getByText("Unavailable")).toBeInTheDocument();
    expect(within(positionDetail).queryByText("Loading")).not.toBeInTheDocument();
    expect(
      within(positionDetail).getByRole("button", {
        name: "Collect Position #1 rewards in STATICS / WETH",
      })
    ).toBeEnabled();
  });

  it("closes More when returning to desktop and does not reopen it on mobile", async () => {
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    resize(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    resize(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });
});

describe("compact Earn positions", () => {
  let compact = true;
  let listeners: Set<() => void>;
  beforeEach(() => {
    compact = true;
    listeners = new Set();
    window.localStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        get matches() {
          return compact;
        },
        addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
      }))
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  const resize = (value: boolean) =>
    act(() => {
      compact = value;
      listeners.forEach((listener) => listener());
    });

  it("shows one summary card and opens More without extra RPC reads", async () => {
    withPhaseOne(<RewardsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Total staked")).not.toBeInTheDocument();
    expect(screen.queryByText("Allocated to pools")).not.toBeInTheDocument();
    const more = screen.getByRole("button", { name: "More" });
    const reads = mocks.read.mock.calls.length;
    more.focus();
    fireEvent.click(more);
    const dialog = screen.getByRole("dialog", { name: "Portfolio summary" });
    expect(within(dialog).getByText("Total staked")).toBeInTheDocument();
    expect(within(dialog).getByText("Allocated to pools")).toBeInTheDocument();
    expect(within(dialog).getByText("Needs attention")).toBeInTheDocument();
    expect(mocks.read).toHaveBeenCalledTimes(reads);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(more);
    fireEvent.click(more);
    resize(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    resize(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("expands position details and preserves a selected frozen claim through resizing", async () => {
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [position(1n), position(2n)],
      nextCursor: null,
    });
    withPhaseOne(<RewardsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    expect(screen.queryByRole("link", { name: "Manage" })).not.toBeInTheDocument();
    const reads = mocks.read.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Show details for Position #2" }));
    const region = screen.getByRole("region", { name: "Your positions" });
    expect(within(region).getByText("Reward assets")).toBeInTheDocument();
    expect(within(region).getByText("Allocated / free")).toBeInTheDocument();
    expect(within(region).getByText("Liquidity")).toBeInTheDocument();
    expect(within(region).getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href",
      "/app/rewards/staking?positionId=2"
    );
    expect(mocks.read).toHaveBeenCalledTimes(reads);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Position #2" }));
    expect(
      screen.getByRole("checkbox", { name: "Select all shown positions" })
    ).toBePartiallyChecked();
    fireEvent.click(screen.getByRole("button", { name: "Collect selected" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const data = mocks.call.mock.calls.at(-1)![0].data;
    const decoded = decodeFunctionData({ abi: staticsBatchRewardsAbi, data });
    expect(decoded.args?.[0]).toHaveLength(1);
    expect(decoded.args?.[0]?.[0]).toMatchObject({ positionId: 2n });
    expect(decoded.args?.[1]?.every((group) => group.positionId === 2n)).toBe(true);
    expect(decoded.args?.[2]?.every((group) => group.positionId === 2n)).toBe(true);
    resize(false);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Position #2" })).toBeChecked();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    resize(true);
    expect(screen.getByRole("button", { name: "Hide details for Position #2" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("sorts compact positions and retains filtering, hidden rows and pagination", async () => {
    const items = Array.from({ length: 26 }, (_, i) => position(BigInt(i + 1)));
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items,
      nextCursor: null,
    });
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "stakePosition"
        ? { stakedBalance: parseEther(String(input.args[0])), rewardMultiplierBps: 10000 }
        : original(input)
    );
    withPhaseOne(<RewardsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Collect" })).toBeEnabled());
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /^Show details/ })[0]).toHaveAccessibleName(
        "Show details for Position #26"
      )
    );
    expect(screen.getAllByRole("checkbox", { name: /^Select Position/ })).toHaveLength(25);
    fireEvent.change(screen.getByRole("combobox", { name: "Sort positions" }), {
      target: { value: "staked:asc" },
    });
    expect(screen.getAllByRole("button", { name: /^Show details/ })[0]).toHaveAccessibleName(
      "Show details for Position #1"
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more · 1" }));
    expect(screen.getAllByRole("checkbox", { name: /^Select Position/ })).toHaveLength(26);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search positions" }), {
      target: { value: "#26" },
    });
    expect(screen.getAllByRole("checkbox", { name: /^Select Position/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Show details for Position #26" }));
    fireEvent.click(screen.getByRole("button", { name: /^Hide$/ }));
    expect(screen.queryByRole("checkbox", { name: "Select Position #26" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show hidden · 1" }));
    expect(screen.getByRole("checkbox", { name: "Select Position #26" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unhide" }));
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("announces the compact balance and allocation cooldown", async () => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation(async (input) => {
      const result = await original(input);
      return input.functionName === "gaugePositionAllocations"
        ? [4000, ...result.slice(1)]
        : result;
    });
    withPhaseOne(<RewardsPage />);
    await screen.findByText(/^Cooldown /);
    expect(
      screen.getByRole("button", { name: "Show details for Position #1" })
    ).toHaveAccessibleDescription(/100 STATICS Cooldown/);
  });

  it("keeps unavailable details and empty wallet actions explicit", async () => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "positionRewardAssets"
        ? Promise.reject(Error("unavailable"))
        : original(input)
    );
    withPhaseOne(<RewardsPage />);
    await screen.findByText("Unavailable");
    expect(
      screen.getByRole("button", { name: "Show details for Position #1" })
    ).toHaveAccessibleDescription("100 STATICS Unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Show details for Position #1" }));
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Manage" })).toBeInTheDocument();
    cleanup();
    mocks.page.mockResolvedValue({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: [],
      nextCursor: null,
    });
    withPhaseOne(<RewardsPage />);
    expect(await screen.findByRole("link", { name: "Create position" })).toHaveAttribute(
      "href",
      "/app/positions"
    );
    expect(screen.getByRole("checkbox", { name: "Select all shown positions" })).toBeDisabled();
  });
});
