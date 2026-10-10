import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import {
  announceProtocolTransactionConfirmed,
  protocolQueryScopes,
} from "@/lib/protocol/reconciliation";
import { ProtocolQueryReconciler } from "@/providers/ProtocolQueryReconciler";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeFunctionData,
  encodeEventTopics,
  encodeAbiParameters,
  getAddress,
  maxUint256,
  zeroAddress,
} from "viem";
import { staticsAbi, staticsRangeGaugeAbi, v4PoolId } from "@statics-protocol/sdk/phase-one";
import { LiquidityPage } from "@/components/liquidity/LiquidityPage";
import type { PhaseOneDeployment, DeploymentOption } from "@/lib/deployments/types";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";
import { DeploymentContext } from "@/providers/deployment-context";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  execute: vi.fn(),
  positions: vi.fn(),
  lpIds: vi.fn(),
  legs: vi.fn(),
  position: vi.fn(),
  native: 10n ** 19n,
  reward: 0n,
  liquidity: 0n,
  allowance: 0n,
}));
vi.mock("wagmi", () => ({
  usePublicClient: () => ({
    chain: { id: 31337 },
    readContract: mocks.read,
    getBalance: async () => mocks.native,
    getBlock: async ({ blockTag }: { blockTag?: string } = {}) => ({
      timestamp: blockTag === "pending" ? 10000000000n : 3000n,
    }),
  }),
}));
vi.mock("@/lib/protocol/transactions", () => ({ executeProtocolTransaction: mocks.execute }));
vi.mock("@/hooks/usePoolMarket", () => ({
  usePoolMarket: () => ({
    stats: null,
    statsQuote: null,
    depth: null,
    candles: null,
    usd: () => null,
  }),
}));
vi.mock("@/hooks/usePhaseOnePools", async () => {
  const { mergePhaseOnePools } = await vi.importActual<
    typeof import("@/lib/phase-one/pool-discovery")
  >("@/lib/phase-one/pool-discovery");
  return {
    usePhaseOnePools: (deployment: PhaseOneDeployment) => ({
      pools: mergePhaseOnePools(deployment.supportedPools, discoveredPools.value),
      discovering: false,
    }),
  };
});
const discoveredPools = vi.hoisted(() => ({
  value: [] as import("@/lib/phase-one/pool-discovery").PhaseOnePool[],
}));
vi.mock("@/lib/indexer/phase-one", () => ({
  loadIndexedPhaseOnePositions: mocks.positions,
  loadIndexedManagedLiquidity: mocks.legs,
  loadIndexedPhaseOnePosition: mocks.position,
}));
vi.mock("@/lib/indexer/statics", () => ({
  loadWalletV4PositionIds: mocks.lpIds,
  configuredIndexerUrlForDeployment: () => "http://localhost/indexer",
}));
const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const wallet = address("9");
const key = {
  currency0: address("2"),
  currency1: address("3"),
  fee: 3000,
  tickSpacing: 60,
  hooks: address("4"),
};
const poolId = v4PoolId(key);
const token = (digit: string, symbol: string) => ({
  address: address(digit),
  name: symbol,
  symbol,
  decimals: 18,
  metadataSource: "reviewed-manifest",
});
const deployment = {
  descriptor: { deploymentId: "fixture", chainId: 31337 },
  contracts: {
    diamond: address("1"),
    statics: address("2"),
    weth: address("3"),
    positionManager: address("5"),
    liquidityManager: address("6"),
    stateView: address("7"),
  },
  supportedPools: [
    {
      poolId,
      poolKey: key,
      token0: token("2", "STATICS"),
      token1: token("3", "WETH"),
      enabled: true,
    },
  ],
} as unknown as PhaseOneDeployment;
const option = {
  networkId: "anvil",
  descriptor: deployment.descriptor,
  launch: null,
  phaseOne: deployment,
  protocol: null,
} satisfies DeploymentOption;
const indexed = (id: bigint) => ({
  positionId: id,
  owner: wallet,
  stakedBalance: 0n,
  activeLegCount: mocks.liquidity > 0n ? 1n : 0n,
  unresolvedObligationCount: mocks.reward > 0n ? 1n : 0n,
  updatedAtBlock: 1n,
});
function tree(
  initialPositionId: bigint | null = null,
  initialPoolId: `0x${string}` | null = null,
  activeOption: DeploymentOption = option
) {
  return (
    <DeploymentContext.Provider
      value={{ active: activeOption, options: [activeOption], selectNetwork: vi.fn() }}
    >
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "ready",
          address: wallet,
          chainId: 31337,
          walletKind: "external",
        }}
      >
        <LiquidityPage initialPositionId={initialPositionId} initialPoolId={initialPoolId} />
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
}
const fiveZero = [0n, 0n, 0n, 0n, 0n];
beforeEach(() => {
  discoveredPools.value = [];
  mocks.native = 10n ** 19n;
  mocks.position.mockReset().mockImplementation(async (id: bigint) => indexed(id));
  mocks.legs.mockReset().mockImplementation(async () => [
    {
      positionId: 1n,
      poolId,
      posmTokenId: 10n,
      tickLower: -60,
      tickUpper: 60,
      liquidity: mocks.liquidity,
      active: mocks.liquidity > 0n,
    },
  ]);
  mocks.reward = 0n;
  mocks.liquidity = 0n;
  mocks.allowance = 0n;
  mocks.positions.mockReset().mockImplementation(async () => ({
    deploymentId: "fixture",
    indexedAtBlock: 1n,
    items: [indexed(1n)],
    nextCursor: null,
  }));
  mocks.lpIds.mockReset().mockResolvedValue([10n]);
  mocks.execute.mockReset().mockResolvedValue(hash("a"));
  mocks.read.mockReset().mockImplementation(async ({ functionName }) => {
    if (functionName === "getSlot0") return [1n << 96n, 0, 0, 3000];
    if (functionName === "lpLeg")
      return {
        manager: zeroAddress,
        posmTokenId: 0n,
        tickLower: -60,
        tickUpper: 60,
        liquidity: mocks.liquidity,
        checkpointInsideRay: fiveZero,
        rewardRemainderRay: fiveZero,
        claimable: [mocks.reward, 0n, 0n, 0n, 0n],
      };
    if (functionName === "previewLpRewards")
      return {
        slotCount: 1,
        assets: [address("2"), zeroAddress, zeroAddress, zeroAddress, zeroAddress],
        amounts: [mocks.reward, 0n, 0n, 0n, 0n],
      };
    if (functionName === "gaugeReserve")
      return { activated: false, periodFinish: 0, lastCheckpoint: 0 };
    if (functionName === "maxGaugeCatchupPeriods") return 52;
    if (functionName === "balanceOf") return 10n ** 24n;
    if (functionName === "getPositionInfo") return [mocks.liquidity, 0n, 0n];
    if (functionName === "getFeeGrowthInside") return [0n, 0n];
    if (functionName === "allowance") return mocks.allowance;
    if (functionName === "positionCreationFee") return 1n;
    throw new Error(`Unexpected RPC ${functionName}`);
  });
});
async function openDeposit() {
  if (!screen.queryByRole("textbox", { name: "Deposit STATICS" })) {
    fireEvent.click(screen.getAllByRole("button", { name: /Add liquidity$/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  }
  return screen.findByRole("textbox", { name: "Deposit STATICS" });
}
async function openDetail() {
  fireEvent.click(await screen.findByRole("button", { name: /STATICS \/ WETH Account #1/ }));
}
async function provideReview() {
  await openDeposit();
  fireEvent.change(screen.getByRole("textbox", { name: "Deposit STATICS" }), {
    target: { value: "1" },
  });
  const button = screen.getByRole("button", { name: "Review Add liquidity" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  return screen.findByRole("button", { name: "Confirm transaction" });
}
describe("Phase 1 liquidity in the existing screen", () => {
  it("reviews fresh collection amounts without slippage and freezes exact payout checks", async () => {
    mocks.liquidity = 10n ** 18n;
    let growth = 1n << 128n;
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation(async (input) => {
      if (input.functionName === "getFeeGrowthInside") return [growth, growth * 2n];
      return original(input);
    });
    render(tree());
    await openDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Collect fees" }));
    expect(screen.queryByRole("textbox", { name: "Slippage (%)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Minimum STATICS" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Minimum WETH" })).not.toBeInTheDocument();
    growth = 2n << 128n;
    fireEvent.click(screen.getByRole("button", { name: "Review Collect fees" }));
    expect(await screen.findByText("Fees to collect: 2 STATICS + 4 WETH")).toBeInTheDocument();
    expect(screen.queryByText("Slippage: 0.5%")).not.toBeInTheDocument();
    expect(screen.queryByText(/Minimum payout:/)).not.toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    const decoded = decodeFunctionData({
      abi: staticsRangeGaugeAbi,
      data: mocks.execute.mock.calls[0][0].data,
    });
    expect(decoded.functionName).toBe("collectNativeFees");
    expect(decoded.args).toEqual([1n, poolId, 2n * 10n ** 18n, 4n * 10n ** 18n, 10000001200n]);
    expect(mocks.read.mock.calls.some(([input]) => input.functionName === "gaugeReserve")).toBe(
      false
    );
  });
  it("fails collection review when the current fees cannot be read", async () => {
    mocks.liquidity = 10n ** 18n;
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation(async (input) => {
      if (input.functionName === "getFeeGrowthInside") throw new Error("Fee RPC unavailable");
      return original(input);
    });
    render(tree());
    await openDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Collect fees" }));
    fireEvent.click(screen.getByRole("button", { name: "Review Collect fees" }));
    expect(await screen.findByText("Fee RPC unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm transaction" })).not.toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("defaults removal to a partial withdrawal and uses Exit for 100%", async () => {
    mocks.liquidity = 100n;
    render(tree());
    await openDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Remove liquidity" }));
    const share = screen.getByRole("slider", { name: "Liquidity to withdraw (%)" });
    expect(share).toHaveValue("50");
    fireEvent.click(screen.getByRole("button", { name: "Review Decrease liquidity" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    const decoded = decodeFunctionData({
      abi: staticsRangeGaugeAbi,
      data: mocks.execute.mock.calls[0][0].data,
    });
    expect(decoded.args?.[2]).toMatchObject({ liquidity: 50n });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Review Decrease liquidity" })).toBeEnabled()
    );
    fireEvent.change(share, { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Review Exit liquidity" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(2));
    expect(mocks.execute.mock.calls[1][0].kind).toBe("phase-one-exit-liquidity");
  });
  it("rebalances using principal with no wallet top-up", async () => {
    mocks.liquidity = 10n ** 21n;
    render(tree());
    await openDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Rebalance" }));
    fireEvent.click(screen.getByRole("button", { name: "Review Rebalance" }));
    expect(await screen.findByText("Maximum token debit: 0 STATICS + 0 WETH")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    const decoded = decodeFunctionData({
      abi: staticsRangeGaugeAbi,
      data: mocks.execute.mock.calls[0][0].data,
    });
    expect(decoded.functionName).toBe("rebalanceLiquidity");
    expect(decoded.args?.[2]).toMatchObject({ amount0Maximum: 0n, amount1Maximum: 0n });
    expect((decoded.args?.[2] as { liquidity: bigint }).liquidity).toBeGreaterThan(0n);
  });
  it("collects fees without gauge reads or unfinished range inputs from another action", async () => {
    mocks.liquidity = 100n;
    render(tree());
    await openDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Rebalance" }));
    fireEvent.click(screen.getByRole("button", { name: /^Common/ }));
    fireEvent.click(screen.getByRole("button", { name: "Collect fees" }));
    fireEvent.click(screen.getByRole("button", { name: "Review Collect fees" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    expect(mocks.execute.mock.calls[0][0].kind).toBe("phase-one-collect-fees");
    expect(mocks.read.mock.calls.some(([input]) => input.functionName === "gaugeReserve")).toBe(
      false
    );
  });
  it("uses discovered positions, defaults full range, reviews limits, and sets deadline after approvals", async () => {
    mocks.execute.mockImplementation(async () => {
      mocks.allowance = maxUint256;
      return hash("a");
    });
    render(tree());
    await openDeposit();
    expect(screen.getByRole("combobox", { name: "Save to account" })).toHaveValue("1");
    expect(screen.getByRole("button", { name: /^Full range/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByRole("textbox", { name: "PositionNFT ID" })).not.toBeInTheDocument();
    const confirm = await provideReview();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(screen.getByText("Maximum token debit: 1 STATICS + 1 WETH")).toBeInTheDocument();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(
        mocks.execute.mock.calls.some(([request]) => request.kind === "phase-one-provide-liquidity")
      ).toBe(true)
    );
    const request = mocks.execute.mock.calls.at(-1)![0];
    const decoded = decodeFunctionData({ abi: staticsRangeGaugeAbi, data: request.data });
    expect(decoded.functionName).toBe("provideLiquidity");
    expect(decoded.args?.[1]).toMatchObject({
      tickLower: -887220,
      tickUpper: 887220,
      deadline: 10000001200n,
    });
    expect(
      mocks.read.mock.calls.filter(([input]) => input.functionName === "allowance")
    ).toHaveLength(4);
  });
  it("recovers an interrupted provision using the receipt-created and indexed NFT without creating another", async () => {
    window.localStorage.setItem("unrelated-setting", "preserved");
    mocks.positions.mockResolvedValue({
      deploymentId: "fixture",
      indexedAtBlock: 1n,
      items: [],
      nextCursor: null,
    });
    const rendered = render(tree());
    fireEvent.click(screen.getAllByRole("button", { name: /Add liquidity$/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Open account" }));
    mocks.execute.mockImplementation(async (request) => {
      if (request.kind === "phase-one-create-position") {
        await request.verifyConfirmation({
          logs: [
            {
              address: deployment.contracts.diamond,
              topics: encodeEventTopics({
                abi: staticsAbi,
                eventName: "PositionCreated",
                args: { positionId: 99n, owner: wallet },
              }),
              data: encodeAbiParameters([], []),
              logIndex: 0,
            },
          ],
        });
        return hash("a");
      }
      throw new Error("Approval interrupted");
    });
    fireEvent.click(await screen.findByRole("button", { name: "Confirm transaction" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Save to account" })).toHaveValue("99")
    );
    fireEvent.click(await provideReview());
    await screen.findByText("Approval interrupted");
    expect(
      mocks.execute.mock.calls.filter(([request]) => request.kind === "phase-one-create-position")
    ).toHaveLength(1);
    rendered.unmount();
    mocks.positions.mockResolvedValue({
      deploymentId: "fixture",
      indexedAtBlock: 2n,
      items: [indexed(99n)],
      nextCursor: null,
    });
    mocks.allowance = maxUint256;
    mocks.execute.mockResolvedValue(hash("b"));
    render(tree());
    await openDeposit();
    expect(screen.getByRole("combobox", { name: "Save to account" })).toHaveValue("99");
    fireEvent.click(await provideReview());
    await waitFor(() =>
      expect(
        mocks.execute.mock.calls.some(([request]) => request.kind === "phase-one-provide-liquidity")
      ).toBe(true)
    );
    expect(
      mocks.execute.mock.calls.filter(([request]) => request.kind === "phase-one-create-position")
    ).toHaveLength(1);
    expect(window.localStorage.getItem("unrelated-setting")).toBe("preserved");
  });
  it("requires explicit review of the reward amount before forfeiture", async () => {
    mocks.reward = 1000000000000000000n;
    const original = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation(async (input) =>
      input.functionName === "gaugeReserve"
        ? { activated: true, periodFinish: 10000000000 - 53 * 604800, lastCheckpoint: 0 }
        : original(input)
    );
    render(tree());
    await openDetail();
    const button = await screen.findByRole("button", { name: "Review forfeiture" });
    fireEvent.click(button);
    await screen.findAllByText("1 STATICS");
    await screen.findByText("You permanently give up this reward amount. It cannot be recovered.");
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(2));
    expect(mocks.execute.mock.calls.map(([request]) => request.kind)).toEqual([
      "phase-one-checkpoint-schedule",
      "phase-one-forfeit-lp-reward",
    ]);
  });
  it("keeps empty NFTs out of the list and calculates paired amounts without more RPC reads", async () => {
    render(tree());
    await screen.findByText("No liquidity positions yet");
    expect(mocks.legs).not.toHaveBeenCalled();
    await openDeposit();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Max" })[0]).toBeEnabled());
    const calls = mocks.read.mock.calls.length;
    fireEvent.change(screen.getByRole("textbox", { name: "Deposit STATICS" }), {
      target: { value: "2" },
    });
    expect(screen.getByRole("textbox", { name: "Deposit WETH" })).toHaveValue("2");
    expect(mocks.read).toHaveBeenCalledTimes(calls);
    fireEvent.click(screen.getByRole("button", { name: "Review Add liquidity" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    fireEvent.change(screen.getByRole("textbox", { name: "Deposit STATICS" }), {
      target: { value: "3" },
    });
    expect(screen.queryByRole("button", { name: "Confirm transaction" })).not.toBeInTheDocument();
  });
  it("blocks invalid amounts and insufficient balances before review without RPC work", async () => {
    render(tree());
    await openDeposit();
    fireEvent.change(screen.getByRole("textbox", { name: "Deposit STATICS" }), {
      target: { value: "abc" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid token amount");
    expect(screen.getByRole("button", { name: "Review Add liquidity" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Deposit STATICS" }), {
      target: { value: "100000000" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/Not enough \w+ for this deposit/);
    expect(screen.getByRole("link", { name: "Swap for STATICS" })).toHaveAttribute(
      "href",
      `/app/swap?in=${address("3")}&out=${address("2")}`
    );
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("builds a range from strategies, steps, chart keys and typed prices, and reviews its ticks", async () => {
    render(tree());
    await openDeposit();
    const min = () => screen.getByRole("textbox", { name: "Min price" });
    const max = () => screen.getByRole("textbox", { name: "Max price" });
    expect(min()).toHaveValue("0");
    expect(max()).toHaveValue("∞");
    expect(screen.getByRole("button", { name: "Raise Min price one step" })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: /^Common/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /^Common/ }));
    expect(screen.getByRole("button", { name: /^Common/ })).toHaveAttribute("aria-pressed", "true");
    // ±10% around tick 0 with spacing 60: ticks -960 and 960.
    expect(min()).toHaveValue(
      new Intl.NumberFormat("en", { maximumSignificantDigits: 7 }).format(1.0001 ** -960)
    );
    expect(max()).toHaveValue(
      new Intl.NumberFormat("en", { maximumSignificantDigits: 7 }).format(1.0001 ** 960)
    );
    fireEvent.click(screen.getByRole("button", { name: "Raise Min price one step" }));
    expect(min()).toHaveValue(
      new Intl.NumberFormat("en", { maximumSignificantDigits: 7 }).format(1.0001 ** -900)
    );
    expect(screen.getByRole("button", { name: /^Common/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    fireEvent.keyDown(screen.getByRole("button", { name: /^Maximum price/ }), { key: "ArrowDown" });
    expect(max()).toHaveValue(
      new Intl.NumberFormat("en", { maximumSignificantDigits: 7 }).format(1.0001 ** 900)
    );
    // A typed price snaps to the nearest usable tick once the field is left.
    fireEvent.change(max(), { target: { value: "2" } });
    expect(max()).toHaveValue("2");
    fireEvent.blur(max());
    expect(max()).toHaveValue(
      new Intl.NumberFormat("en", { maximumSignificantDigits: 7 }).format(1.0001 ** 6960)
    );
    const confirm = await provideReview();
    expect(confirm).toBeInTheDocument();
    expect(
      screen.getByText(
        `Price range: ${(1.0001 ** -900).toPrecision(6)} – ${(1.0001 ** 6960).toPrecision(6)} WETH/STATICS`
      )
    ).toBeInTheDocument();
  });
  it("clears a prepared review and blocks signing when a range draft becomes invalid", async () => {
    render(tree());
    await openDeposit();
    fireEvent.click(screen.getByRole("button", { name: /^Common/ }));
    await provideReview();
    fireEvent.change(screen.getByRole("textbox", { name: "Min price" }), {
      target: { value: "oops" },
    });
    expect(screen.queryByRole("button", { name: "Confirm transaction" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review Add liquidity" })).toBeDisabled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("takes only the held token for a one-sided range", async () => {
    render(tree());
    await openDeposit();
    await waitFor(() => expect(screen.getByRole("button", { name: /^Below price/ })).toBeEnabled());
    const below = screen.getByRole("button", { name: /^Below price/ });
    expect(below).toHaveTextContent("Holds WETH only.");
    fireEvent.click(below);
    expect(screen.getByRole("textbox", { name: "Deposit STATICS" })).toBeDisabled();
    expect(screen.getByText("Not needed for this range")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Deposit WETH" }), {
      target: { value: "1" },
    });
    const review = screen.getByRole("button", { name: "Review Add liquidity" });
    await waitFor(() => expect(review).toBeEnabled());
    fireEvent.click(review);
    expect(
      await screen.findByText(/^Maximum token debit: 0 STATICS \+ 1 WETH/)
    ).toBeInTheDocument();
  });
  it("reviews ETH wrapping and stops before approvals if wrapping fails", async () => {
    const read = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "balanceOf" && input.address === address("3")
        ? Promise.resolve(0n)
        : read(input)
    );
    mocks.execute.mockRejectedValue(new Error("Wrapping reverted"));
    render(tree());
    await openDeposit();
    fireEvent.click(screen.getByRole("button", { name: "ETH + WETH" }));
    const confirm = await provideReview();
    await screen.findByText("Wrap up to 1 ETH to WETH before depositing.");
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.click(confirm);
    await screen.findByText("Wrapping reverted");
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute.mock.calls[0][0]).toMatchObject({
      kind: "phase-one-wrap-native",
      to: address("3"),
      value: 10n ** 18n,
    });
  });
  it("resumes with existing WETH after an interrupted wrapping step", async () => {
    let weth = 0n;
    const read = mocks.read.getMockImplementation()!;
    mocks.read.mockImplementation((input) =>
      input.functionName === "balanceOf" && input.address === address("3")
        ? Promise.resolve(weth)
        : read(input)
    );
    mocks.allowance = maxUint256;
    render(tree());
    await openDeposit();
    fireEvent.click(screen.getByRole("button", { name: "ETH + WETH" }));
    const confirm = await provideReview();
    weth = 10n ** 18n;
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    expect(mocks.execute.mock.calls[0][0].kind).toBe("phase-one-provide-liquidity");
  });
  it("opens an existing liquidity leg from Position NFT navigation", async () => {
    mocks.liquidity = 10n ** 21n;
    render(tree(1n));
    await screen.findByRole("heading", { name: "Position details" });
    expect(await screen.findByRole("button", { name: "Remove liquidity" })).toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("opens a deposit for an owned Position NFT that has no liquidity", async () => {
    render(tree(1n));
    expect(await screen.findByRole("textbox", { name: "Deposit STATICS" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Save to account" })).toHaveValue("1");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

it("shows unavailable indexed pools without crashing or hiding retained rewards", async () => {
  mocks.liquidity = 100n;
  const disabled = {
    ...option,
    phaseOne: {
      ...deployment,
      supportedPools: [],
    },
  };
  render(tree(null, null, disabled));
  expect(
    await screen.findByText("Account #1 has liquidity in a pool that is currently unavailable.")
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Manage rewards" })).toHaveAttribute(
    "href",
    `/app/rewards/gauge?positionId=1&poolId=${poolId}`
  );
  expect(mocks.execute).not.toHaveBeenCalled();
});
it("rejects an unknown pool deep link with an explicit pool reset", async () => {
  render(tree(1n, hash("f")));
  expect(
    await screen.findByText("This pool is unavailable. Choose an enabled pool to continue.")
  ).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Deposit STATICS" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Choose a pool" })).toBeInTheDocument();
  expect(mocks.execute).not.toHaveBeenCalled();
});

it("does not substitute another NFT when a requested position belongs to a different wallet", async () => {
  mocks.position.mockResolvedValue({ ...indexed(99n), owner: address("f") });
  render(tree(99n));
  expect(
    await screen.findByText(
      "This account could not be loaded or does not belong to your wallet. Choose a pool and one of your accounts to continue."
    )
  ).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Deposit STATICS" })).not.toBeInTheDocument();
  expect(mocks.execute).not.toHaveBeenCalled();
});
it("does not open a deposit when focused liquidity discovery fails", async () => {
  mocks.liquidity = 100n;
  mocks.legs.mockRejectedValue(new Error("indexer unavailable"));
  render(tree(1n));
  expect(
    await screen.findByText(
      "This account could not be loaded or does not belong to your wallet. Choose a pool and one of your accounts to continue."
    )
  ).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Deposit STATICS" })).not.toBeInTheDocument();
});
it("does not show a definitive empty state while ownership discovery has another page", async () => {
  mocks.positions.mockResolvedValue({
    deploymentId: "fixture",
    indexedAtBlock: 1n,
    items: [indexed(1n)],
    nextCursor: "1",
  });
  render(tree());
  await screen.findByRole("button", { name: "Load more accounts" });
  expect(screen.queryByText("Your liquidity positions will appear here.")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "No liquidity positions yet" })
  ).not.toBeInTheDocument();
});

it("retains only the inactive pool with actual exit obligations", async () => {
  mocks.reward = 100n;
  mocks.legs.mockResolvedValue(
    [poolId, hash("f")].map((id) => ({
      positionId: 1n,
      poolId: id,
      posmTokenId: 10n,
      tickLower: -60,
      tickUpper: 60,
      liquidity: 0n,
      active: false,
    }))
  );
  const read = mocks.read.getMockImplementation()!;
  mocks.read.mockImplementation((input) =>
    input.functionName === "lpLeg" && input.args[1] === hash("f")
      ? Promise.resolve({ liquidity: 0n, claimable: fiveZero, rewardRemainderRay: fiveZero })
      : read(input)
  );
  render(tree());
  expect(
    await screen.findByRole("button", { name: /STATICS \/ WETH Account #1/ })
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Account #1 has liquidity in a pool that is currently unavailable.")
  ).not.toBeInTheDocument();
});
it("drops a resolved exited leg after a claim confirms, even before the indexer catches up", async () => {
  mocks.reward = 100n;
  mocks.legs.mockResolvedValue([
    {
      positionId: 1n,
      poolId,
      posmTokenId: 10n,
      tickLower: -60,
      tickUpper: 60,
      liquidity: 0n,
      active: false,
    },
  ]);
  const read = mocks.read.getMockImplementation()!;
  let claimed = false;
  // The indexer still reports the obligation (mocks.reward stays non-zero); only the
  // chain's lpLeg state shows the reward was claimed.
  mocks.read.mockImplementation((input) =>
    claimed && input.functionName === "lpLeg"
      ? Promise.resolve({ liquidity: 0n, claimable: fiveZero, rewardRemainderRay: fiveZero })
      : read(input)
  );
  render(
    <>
      <ProtocolQueryReconciler />
      {tree()}
    </>
  );
  expect(
    await screen.findByRole("button", { name: /STATICS \/ WETH Account #1/ })
  ).toBeInTheDocument();
  claimed = true;
  act(() =>
    announceProtocolTransactionConfirmed({
      wallet,
      chainId: 31337,
      deploymentId: deployment.descriptor.deploymentId,
      blockNumber: 11n,
      kind: "phase-one-claim-lp-rewards",
      scopes: protocolQueryScopes("phase-one-claim-lp-rewards"),
    })
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: /STATICS \/ WETH Account #1/ })
    ).not.toBeInTheDocument()
  );
});

it("reuses earlier position discovery when loading another ownership page", async () => {
  mocks.liquidity = 100n;
  mocks.positions.mockImplementation(async (_wallet, _deployment, _url, cursor) => ({
    deploymentId: "fixture",
    indexedAtBlock: 1n,
    items: [indexed(cursor ? 2n : 1n)],
    nextCursor: cursor ? null : "1",
  }));
  mocks.legs.mockImplementation(async (id) => [
    {
      positionId: id,
      poolId,
      posmTokenId: id,
      tickLower: -60,
      tickUpper: 60,
      liquidity: 100n,
      active: true,
    },
  ]);
  render(tree());
  await screen.findByRole("button", { name: /STATICS \/ WETH Account #1/ });
  fireEvent.click(screen.getByRole("button", { name: "Load more accounts" }));
  await screen.findByRole("button", { name: /STATICS \/ WETH Account #2/ });
  expect(mocks.legs).toHaveBeenCalledTimes(2);
});
it("waits for live price before enabling custom range defaults", async () => {
  const read = mocks.read.getMockImplementation()!;
  let loaded!: (value: readonly [bigint, number, number, number]) => void;
  mocks.read.mockImplementation((input) =>
    input.functionName === "getSlot0"
      ? new Promise((resolve) => {
          loaded = resolve;
        })
      : read(input)
  );
  render(tree());
  await openDeposit();
  expect(screen.getByRole("button", { name: /^Common/ })).toBeDisabled();
  loaded([1n << 96n, 0, 0, 3000]);
  await waitFor(() => expect(screen.getByRole("button", { name: /^Common/ })).toBeEnabled());
});

it("accepts a mixed-case bytes32 pool deep link", async () => {
  render(tree(1n, `0x${poolId.slice(2).toUpperCase()}`));
  expect(await screen.findByRole("textbox", { name: "Deposit STATICS" })).toBeInTheDocument();
  expect(
    screen.queryByText("This pool is unavailable. Choose an enabled pool to continue.")
  ).not.toBeInTheDocument();
  expect(mocks.execute).not.toHaveBeenCalled();
});

it("lists a discovered pool as unreviewed and asks for its token to be checked before depositing", async () => {
  const fresh = address("7");
  const { v4PoolId } = await import("@statics-protocol/sdk/phase-one");
  const freshKey = { ...key, currency1: fresh };
  discoveredPools.value = [
    {
      poolId: v4PoolId(freshKey),
      poolKey: freshKey,
      token0: token("2", "STATICS"),
      token1: { ...token("7", "NEWX"), metadataSource: "onchain-import" },
      reviewed: false,
      swappable: true,
    },
  ] as never;
  render(tree());
  fireEvent.click((await screen.findAllByRole("button", { name: /Add liquidity$/ }))[0]!);
  const option = screen.getByRole("button", { name: /STATICS \/ NEWX/ });
  expect(option).toHaveTextContent("Unreviewed");
  fireEvent.click(option);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Deposit STATICS" }), {
    target: { value: "1" },
  });
  const warning = screen.getByRole("note");
  expect(warning).toHaveTextContent(fresh);
  const review = screen.getByRole("button", { name: "Review Add liquidity" });
  expect(review).toBeDisabled();
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "I have checked the address and want to add liquidity to this pool.",
    })
  );
  await waitFor(() => expect(review).toBeEnabled());
  fireEvent.click(review);
  await screen.findByRole("button", { name: "Confirm transaction" });
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "I have checked the address and want to add liquidity to this pool.",
    })
  );
  expect(screen.queryByRole("button", { name: "Confirm transaction" })).not.toBeInTheDocument();
  expect(review).toBeDisabled();
  discoveredPools.value = [];
});

it.each([true, false])("keeps a paused pool manageable (reviewed: %s)", async (reviewed) => {
  mocks.liquidity = 10n ** 18n;
  discoveredPools.value = [
    {
      poolId,
      poolKey: key,
      token0: token("2", "STATICS"),
      token1: token("3", "WETH"),
      reviewed,
      swappable: true,
      liquidityEnabled: false,
    },
  ] as never;
  const active = reviewed ? option : { ...option, phaseOne: { ...deployment, supportedPools: [] } };
  render(tree(1n, poolId, active));
  expect(await screen.findByRole("button", { name: "Remove liquidity" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Add liquidity" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Collect fees" })).toBeEnabled();
  expect(
    screen.queryByText("This pool is unavailable. Choose an enabled pool to continue.")
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collect fees" }));
  const review = screen.getByRole("button", { name: "Review Collect fees" });
  await waitFor(() => expect(review).toBeEnabled());
  fireEvent.click(review);
  expect(await screen.findByRole("button", { name: "Confirm transaction" })).toBeEnabled();
  expect(mocks.execute).not.toHaveBeenCalled();
});
