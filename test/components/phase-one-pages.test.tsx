import { fireEvent, render, screen, waitFor, within } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData, getAddress, maxUint256, parseEther, zeroAddress } from "viem";
import { staticsGaugeIncentivesAbi, staticsRangeGaugeAbi } from "@statics-protocol/sdk/phase-one";
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
}));
vi.mock("wagmi", () => ({
  usePublicClient: () => ({
    chain: { id: 31337 },
    readContract: mocks.read,
    getBlock: async () => ({ timestamp: 3000n }),
  }),
}));
vi.mock("@/lib/protocol/transactions", () => ({ executeProtocolTransaction: mocks.execute }));
vi.mock("@/lib/indexer/phase-one", () => ({
  loadIndexedPhaseOnePositions: mocks.page,
  loadIndexedPhaseOnePosition: mocks.position,
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
function withPhaseOne(ui: React.ReactElement) {
  return render(
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
        {ui}
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
}
beforeEach(() => {
  mocks.execute.mockReset().mockResolvedValue(hash("f"));
  mocks.position.mockReset().mockImplementation(async (id) => position(id));
  mocks.page.mockReset().mockResolvedValue({
    deploymentId: "phase-one-fixture",
    indexedAtBlock: 1n,
    items: [position(1n)],
    nextCursor: null,
  });
  mocks.read.mockReset().mockImplementation(async ({ functionName, args }) => {
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
    if (functionName === "previewLpRewards")
      return {
        slotCount: 1,
        assets: [tokens[0].address, zeroAddress, zeroAddress, zeroAddress, zeroAddress],
        amounts: [parseEther(args[1] === hash("1") ? "1" : "9"), 0n, 0n, 0n, 0n],
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
});

describe("additive Phase 1 screens", () => {
  it("retains Position catalog styling and keeps staking in Rewards", async () => {
    withPhaseOne(<PositionListPage />);
    expect(await screen.findByRole("link", { name: "Position #1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your Position NFTs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stake STATICS" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create position" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("loads position 101 through the existing selector", async () => {
    mocks.page.mockImplementation(async (_owner, _deployment, _url, cursor) => ({
      deploymentId: "phase-one-fixture",
      indexedAtBlock: 1n,
      items: cursor
        ? [position(101n)]
        : Array.from({ length: 100 }, (_, index) => position(BigInt(index + 1))),
      nextCursor: cursor ? null : "100",
    }));
    withPhaseOne(<RewardsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more positions" }));
    expect(await screen.findByRole("option", { name: "Position #101" })).toBeInTheDocument();
    expect(mocks.page.mock.calls.at(-1)?.[3]).toBe("100");
  });
  it("preserves initialPositionId navigation beyond the first page", async () => {
    withPhaseOne(<RewardsPage initialPositionId={101n} />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Position" })).toHaveValue("101")
    );
    expect(await screen.findByRole("heading", { name: "Position #101" })).toBeInTheDocument();
  });
  it("claims rewards from the newly selected pool", async () => {
    withPhaseOne(<RewardsPage />);
    const claim = await screen.findByRole("button", { name: "Claim LP Gauge Rewards" });
    await waitFor(() => expect(claim).toBeEnabled());
    fireEvent.change(screen.getByRole("combobox", { name: "Pool" }), {
      target: { value: hash("2") },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Claim LP Gauge Rewards" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Claim LP Gauge Rewards" }));
    await screen.findByText("Minimum payout: 8.955 STATICS");
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled());
    const decoded = decodeFunctionData({
      abi: staticsRangeGaugeAbi,
      data: mocks.execute.mock.calls.at(-1)![0].data,
    });
    expect(decoded.args?.[1]).toBe(hash("2"));
  });
  it.each([
    ["Claim LP Gauge Rewards", "claimLpRewards", 0, "1.99"],
    ["Claim LP bribes", "claimLpRewards", 1, "4.975"],
    ["Claim allocator bribes", "claimGaugeAllocatorRewards", 1, "2.985"],
  ] as const)("keeps %s scoped to its funding source", async (button, method, slot, minimum) => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation(async (input) => {
      if (input.functionName === "previewLpRewards")
        return {
          slotCount: 2,
          // Direct funding may also use STATICS. Classify by slot, not token symbol.
          assets: [tokens[0].address, tokens[0].address, zeroAddress, zeroAddress, zeroAddress],
          amounts: [parseEther("2"), parseEther("5"), 0n, 0n, 0n],
        };
      if (input.functionName === "previewGaugeAllocatorRewards")
        return [
          {
            slot: 1,
            asset: tokens[0].address,
            allocation: parseEther("10"),
            amount: parseEther("3"),
          },
        ];
      return original(input);
    });
    withPhaseOne(<RewardsPage />);
    const gauge = await screen.findByRole("article", { name: "LP Gauge Rewards" });
    await within(gauge).findByText("2 STATICS");
    expect(within(gauge).queryByText("5 STATICS")).not.toBeInTheDocument();
    const bribes = screen.getByRole("region", { name: "Bribe Rewards" });
    expect(within(bribes).getByText("5 STATICS")).toBeInTheDocument();
    expect(within(bribes).getByText("3 STATICS")).toBeInTheDocument();
    expect(within(bribes).queryByText("2 STATICS")).not.toBeInTheDocument();
    const claim = screen.getByRole("button", { name: button });
    await waitFor(() => expect(claim).toBeEnabled());
    fireEvent.click(claim);
    await screen.findByText(`Minimum payout: ${minimum} STATICS`);
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    const decoded = decodeFunctionData({
      abi: [...staticsRangeGaugeAbi, ...staticsGaugeIncentivesAbi],
      data: mocks.execute.mock.calls[0][0].data,
    });
    expect(decoded.functionName).toBe(method);
    expect(decoded.args?.[2]).toEqual([slot]);
    expect(decoded.args?.[3]).toEqual([parseEther(minimum)]);
    expect(decoded.args?.[4]).toBe(wallet);
  });
  it.each(["opt-out", "full unstake"])(
    "keeps accrued global rewards claimable after %s",
    async (kind) => {
      const original = mocks.read.getMockImplementation()!;
      mocks.read.mockImplementation(async (input) => {
        if (input.functionName === "positionRewardAssets") return [];
        if (input.functionName === "stakePosition")
          return {
            stakedBalance: kind === "full unstake" ? 0n : parseEther("100"),
            rewardMultiplierBps: 10000,
          };
        return original(input);
      });
      withPhaseOne(<RewardsPage />);
      const button = await screen.findByRole("button", { name: "Claim staking rewards" });
      await waitFor(() => expect(button).toBeEnabled());
      fireEvent.click(button);
      await screen.findByText("Minimum payout: 2.985 STATICS");
      fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
      await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
      expect(mocks.execute.mock.calls[0][0].kind).toBe("phase-one-claim-global-rewards");
      expect(
        mocks.read.mock.calls.some(([input]) =>
          ["rewardBookNeedsCheckpoint", "unfundedSwapRewards"].includes(input.functionName)
        )
      ).toBe(false);
    }
  );

  it("editing and clearing one allocation preserves the other pool", async () => {
    withPhaseOne(<RewardsPage />);
    const save = await screen.findByRole("button", { name: "Review allocation" });
    fireEvent.click(screen.getByText("Allocate staked STATICS to pools"));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Allocated STATICS" })).toHaveValue("10")
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Allocated STATICS" }), {
      target: { value: "0" },
    });
    fireEvent.click(save);
    await screen.findByRole("button", { name: "Confirm transaction" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled());
    const decoded = decodeFunctionData({
      abi: staticsGaugeIncentivesAbi,
      data: mocks.execute.mock.calls.at(-1)![0].data,
    });
    expect(decoded.args).toEqual([1n, [hash("2")], [parseEther("20")]]);
    expect(
      screen.queryByLabelText("Reward assets (comma-separated addresses)")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/maintenance console/i)).not.toBeInTheDocument();
  });
  it("uses wallet Max and keeps staking review inside its card without sending", async () => {
    withPhaseOne(<RewardsPage />);
    const card = await screen.findByRole("region", { name: "Stake STATICS" });
    const max = within(card).getByRole("button", { name: "Max" });
    await waitFor(() => expect(max).toBeEnabled());
    fireEvent.click(max);
    expect(within(card).getByRole("textbox", { name: "STATICS amount" })).toHaveValue("500");
    fireEvent.click(within(card).getByRole("button", { name: "Review stake" }));
    const review = await within(card).findByRole("region", { name: "Review transaction" });
    expect(within(review).getByText("500 STATICS")).toBeInTheDocument();
    expect(within(review).getByText(/approve STATICS first/)).toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.click(within(review).getByRole("button", { name: "Cancel" }));
    expect(within(card).getByRole("textbox", { name: "STATICS amount" })).toHaveValue("500");
  });
  it("uses the unstake toggle and excludes gauge-locked stake from Max", async () => {
    withPhaseOne(<RewardsPage />);
    const card = await screen.findByRole("region", { name: "Stake STATICS" });
    await waitFor(() => expect(within(card).getByRole("button", { name: "Max" })).toBeEnabled());
    fireEvent.click(within(card).getByRole("button", { name: "Unstake" }));
    fireEvent.click(within(card).getByRole("button", { name: "Max" }));
    expect(within(card).getByRole("textbox", { name: "STATICS amount" })).toHaveValue("70");
    expect(within(card).getByRole("button", { name: "Review unstake" })).toBeEnabled();
    expect(within(card).queryByRole("button", { name: "Review stake" })).not.toBeInTheDocument();
  });
  it("prevents unstaking when the position has no stake", async () => {
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation(async (input) =>
      input.functionName === "stakePosition"
        ? { stakedBalance: 0n, rewardMultiplierBps: 10000 }
        : original(input)
    );
    withPhaseOne(<RewardsPage />);
    const card = await screen.findByRole("region", { name: "Stake STATICS" });
    fireEvent.click(within(card).getByRole("button", { name: "Unstake" }));
    fireEvent.change(within(card).getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "1" },
    });
    await waitFor(() =>
      expect(
        within(card).getByText("Amount exceeds stake available after pool locks.")
      ).toBeInTheDocument()
    );
    expect(within(card).getByRole("button", { name: "Review unstake" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Max" })).toBeDisabled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it.each(["0", "-1", "invalid", "501"])(
    "disables review for invalid or excessive amount %s",
    async (value) => {
      withPhaseOne(<RewardsPage />);
      const card = await screen.findByRole("region", { name: "Stake STATICS" });
      await waitFor(() => expect(within(card).getByRole("button", { name: "Max" })).toBeEnabled());
      fireEvent.change(within(card).getByRole("textbox", { name: "STATICS amount" }), {
        target: { value },
      });
      expect(within(card).getByRole("button", { name: "Review stake" })).toBeDisabled();
      expect(mocks.execute).not.toHaveBeenCalled();
    }
  );
  it("preserves stake input and reward asset drafts when the pool changes", async () => {
    withPhaseOne(<RewardsPage />);
    const card = await screen.findByRole("region", { name: "Stake STATICS" });
    await waitFor(() => expect(within(card).getByRole("button", { name: "Max" })).toBeEnabled());
    fireEvent.change(within(card).getByRole("textbox", { name: "STATICS amount" }), {
      target: { value: "25" },
    });
    fireEvent.click(within(card).getByRole("button", { name: "WETH" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Pool" }), {
      target: { value: hash("2") },
    });
    expect(within(card).getByRole("textbox", { name: "STATICS amount" })).toHaveValue("25");
    expect(within(card).getByRole("button", { name: "WETH" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(card).getByRole("button", { name: "Save reward assets" })).toBeInTheDocument();
  });
  it("clears only the pool review when the pool changes", async () => {
    withPhaseOne(<RewardsPage />);
    const claim = await screen.findByRole("button", { name: "Claim LP Gauge Rewards" });
    await waitFor(() => expect(claim).toBeEnabled());
    fireEvent.click(claim);
    await screen.findByRole("button", { name: "Confirm transaction" });
    fireEvent.change(screen.getByRole("combobox", { name: "Pool" }), {
      target: { value: hash("2") },
    });
    expect(screen.queryByRole("button", { name: "Confirm transaction" })).not.toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
