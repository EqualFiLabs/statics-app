import { fireEvent, render, screen, waitFor, within } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeFunctionData,
  getAddress,
  maxUint256,
  encodeFunctionResult,
  parseEther,
  zeroAddress,
} from "viem";
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
    getBlock: async () => ({ timestamp: 3000n }),
  }),
}));
vi.mock("@/lib/protocol/transactions", () => ({ executeProtocolTransaction: mocks.execute }));
vi.mock("@/lib/indexer/phase-one", () => ({
  loadIndexedPhaseOnePositions: mocks.page,
  loadIndexedPhaseOnePosition: mocks.position,
  loadIndexedAllocationSnapshot: mocks.allocations,
}));
const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const wallet = address("9");
const tokens = ["STATICS", "WETH", "TOKEN"].map((symbol, index) => ({
  address: address(String(index + 2)),
  name: symbol,
  symbol,
  decimals: 18,
  metadataSource: "reviewed-manifest" as const,
}));
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
  mocks.params = new URLSearchParams();
  mocks.push.mockReset();
  mocks.replace.mockReset();
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
      return { activated: false, periodFinish: 0, lastCheckpoint: 0 };
    if (functionName === "maxGaugeCatchupPeriods") return 10;
    if (functionName === "lpLeg") return { liquidity: 0n };
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
  it("retains Position catalog styling and links staking management to its focused route", async () => {
    withPhaseOne(<PositionListPage />);
    expect(await screen.findByRole("link", { name: "Position #1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your Position NFTs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stake STATICS" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create position" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    expect(mocks.execute).not.toHaveBeenCalled();
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
  it("loads ownership beyond 100 and scopes management to an explicitly requested NFT", async () => {
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
    expect(await screen.findByRole("option", { name: "Position #101" })).toBeInTheDocument();
    expect(mocks.page.mock.calls.at(-1)?.[3]).toBe("100");
    await waitFor(() =>
      expect(
        mocks.read.mock.calls.some(
          ([input]) => input.functionName === "stakePosition" && input.args[0] === 101n
        )
      ).toBe(true)
    );
    expect(
      mocks.read.mock.calls.some(
        ([input]) => input.functionName === "stakePosition" && input.args[0] === 1n
      )
    ).toBe(false);
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
  it("does not perform pool, allocation, or reserve reads on the initial staking screen", async () => {
    withPhaseOne(<RewardsPage earnView="staking" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Max" })).toBeEnabled());
    expect(
      mocks.read.mock.calls.some(([input]) =>
        /gauge|lpLeg|previewLp|Reserve/i.test(input.functionName)
      )
    ).toBe(false);
    expect(mocks.allocations).not.toHaveBeenCalled();
  });
  it("reads only LP reward sources on Gauge and survives an unrelated allocator failure", async () => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "positionGaugeAllocatorPools"
        ? Promise.reject(Error("allocator unavailable"))
        : original(input)
    );
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Claim displayed rewards" })).toBeEnabled()
    );
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
    fireEvent.click(screen.getByRole("button", { name: "Claim displayed rewards" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const decoded = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls[0][0].data,
    });
    expect(decoded.args?.[0]).toEqual([]);
    expect(decoded.args?.[2]).toEqual([]);
    expect(decoded.args?.[1]).toMatchObject([{ positionId: 1n, slots: [0] }]);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("separates LP and allocator bribes without staking or allocation-management reads", async () => {
    mocks.params = new URLSearchParams("share=allocator");
    withPhaseOne(<RewardsPage earnView="bribes" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Claim displayed rewards" })).toBeEnabled()
    );
    expect(
      mocks.read.mock.calls.some(([input]) =>
        ["stakePosition", "positionGaugePools", "gaugePositionAllocations", "lpLeg"].includes(
          input.functionName
        )
      )
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Claim displayed rewards" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const decoded = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls[0][0].data,
    });
    expect(decoded.args?.[1]).toEqual([]);
    expect(decoded.args?.[2]).toHaveLength(2);
  });
  it("selects all filtered pools across pages and deduplicates parent and child rows", async () => {
    const poolIds = Array.from(
      { length: 12 },
      (_, index) => `0x${(index + 1).toString(16).padStart(64, "0")}`
    );
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "positionGaugePools" ? [poolIds, 12n] : original(input)
    );
    withPhaseOne(<RewardsPage earnView="gauge" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Claim displayed rewards" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all filtered results" }));
    expect(screen.getByText("12 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Claim selected rewards" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    const decoded = decodeFunctionData({
      abi: staticsBatchRewardsAbi,
      data: mocks.call.mock.calls[0][0].data,
    });
    expect(decoded.args?.[1]).toHaveLength(12);
  });
  it("preserves applicable URL filters in feature navigation", async () => {
    mocks.params = new URLSearchParams(
      `positionId=1&poolId=${hash("1")}&asset=${tokens[1].address}&share=allocator`
    );
    withPhaseOne(<RewardsPage earnView="bribes" />);
    expect(screen.getByRole("link", { name: "Staking" })).toHaveAttribute(
      "href",
      `/app/rewards/staking?positionId=1&asset=${tokens[1].address}`
    );
    expect(screen.getByRole("link", { name: "Allocations" })).toHaveAttribute(
      "href",
      `/app/rewards/allocations?positionId=1&poolId=${hash("1")}`
    );
  });
  it("keeps a partial ownership result visible but disables claims", async () => {
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
    expect(screen.getByRole("button", { name: "Claim displayed rewards" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Position #1" })).toBeInTheDocument();
  });
  it("clearing one allocation preserves other pools, with no reward-source reads", async () => {
    withPhaseOne(<RewardsPage earnView="allocations" />);
    const input = await screen.findByRole("textbox", { name: "Allocated STATICS" });
    await waitFor(() => expect(input).toHaveValue("10"));
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Review allocation" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
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
    fireEvent.click(screen.getByRole("checkbox", { name: "STATICS / WETH" }));
    expect(screen.getByRole("button", { name: "Claim displayed rewards" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Claim selected rewards" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Claim selected rewards" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
  });
  it("keeps retained allocation pools valid when absent from enabled manifests", async () => {
    mocks.params = new URLSearchParams(`poolId=${hash("3")}`);
    mocks.allocations.mockResolvedValue({
      totalAllocated: parseEther("30"),
      lockedStake: parseEther("30"),
      allocations: [{ poolId: hash("3"), amount: parseEther("30"), eligibilityVersion: hash("a") }],
      nextAllocationAt: 0n,
    });
    withPhaseOne(<RewardsPage earnView="allocations" />);
    await screen.findByRole("textbox", { name: "Allocated STATICS" });
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
  await waitFor(() =>
    expect(screen.getByRole("link", { name: "Create position" })).toBeInTheDocument()
  );
  expect(screen.queryByText("Loading your positions and rewards…")).not.toBeInTheDocument();
});
