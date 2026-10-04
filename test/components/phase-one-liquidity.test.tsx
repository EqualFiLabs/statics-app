import { fireEvent, render, screen, waitFor } from "@/test/render";
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
  reward: 0n,
  liquidity: 0n,
  allowance: 0n,
}));
vi.mock("wagmi", () => ({
  usePublicClient: () => ({
    chain: { id: 31337 },
    readContract: mocks.read,
    getBlock: async ({ blockTag }: { blockTag?: string } = {}) => ({
      timestamp: blockTag === "pending" ? 10000000000n : 3000n,
    }),
  }),
}));
vi.mock("@/lib/protocol/transactions", () => ({ executeProtocolTransaction: mocks.execute }));
vi.mock("@/lib/indexer/phase-one", () => ({ loadIndexedPhaseOnePositions: mocks.positions }));
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
  activeLegCount: 0n,
  unresolvedObligationCount: 0n,
  updatedAtBlock: 1n,
});
function tree() {
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
          walletKind: "external",
        }}
      >
        <LiquidityPage />
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
}
const fiveZero = [0n, 0n, 0n, 0n, 0n];
beforeEach(() => {
  mocks.reward = 0n;
  mocks.liquidity = 0n;
  mocks.allowance = 0n;
  mocks.positions.mockReset().mockResolvedValue({
    deploymentId: "fixture",
    indexedAtBlock: 1n,
    items: [indexed(1n)],
    nextCursor: null,
  });
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
    if (functionName === "allowance") return mocks.allowance;
    if (functionName === "positionCreationFee") return 1n;
    throw new Error(`Unexpected RPC ${functionName}`);
  });
});
async function provideReview() {
  await screen.findByRole("textbox", { name: "Maximum STATICS" });
  fireEvent.change(screen.getByRole("textbox", { name: "Maximum STATICS" }), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Maximum WETH" }), {
    target: { value: "1" },
  });
  const button = screen.getByRole("button", { name: "Review Add liquidity" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  return screen.findByRole("button", { name: "Confirm transaction" });
}
describe("Phase 1 liquidity in the existing screen", () => {
  it("defaults Decrease to a valid partial withdrawal and directs full withdrawals to Exit", async () => {
    mocks.liquidity = 100n;
    render(tree());
    fireEvent.click(await screen.findByRole("button", { name: "Decrease liquidity" }));
    const share = screen.getByRole("textbox", { name: "Liquidity to withdraw (%)" });
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
    fireEvent.click(screen.getByRole("button", { name: "Review Decrease liquidity" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use Exit");
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
  it("rebalances using principal with no wallet top-up", async () => {
    mocks.liquidity = 10n ** 21n;
    render(tree());
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
    fireEvent.click(await screen.findByRole("button", { name: "Rebalance" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Full range" }));
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
    expect(await screen.findByRole("button", { name: "Position #1" })).toHaveClass("lp-position");
    expect(await screen.findByRole("checkbox", { name: "Full range" })).toBeChecked();
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
    fireEvent.click(screen.getByRole("button", { name: "Create position" }));
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
    await screen.findByRole("button", { name: "Position #99" });
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
    expect(await screen.findByRole("button", { name: "Position #99" })).toBeInTheDocument();
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
    const button = await screen.findByRole("button", { name: "Review forfeiture" });
    fireEvent.click(button);
    await screen.findByText("1 STATICS");
    await screen.findByText("You permanently give up this reward amount. It cannot be recovered.");
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(2));
    expect(mocks.execute.mock.calls.map(([request]) => request.kind)).toEqual([
      "phase-one-checkpoint-schedule",
      "phase-one-forfeit-lp-reward",
    ]);
  });
});
