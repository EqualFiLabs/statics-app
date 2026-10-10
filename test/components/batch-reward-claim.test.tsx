import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData, encodeFunctionResult, getAddress, parseEther } from "viem";
import { staticsBatchRewardsAbi, staticsAggregatedBatchRewardsAbi } from "@statics-protocol/sdk";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import { BatchRewardClaim } from "@/components/rewards/BatchRewardClaim";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { PositionRewardPortfolio } from "@/lib/phase-one/reward-portfolio";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

const batchAbi = [...staticsBatchRewardsAbi, ...staticsAggregatedBatchRewardsAbi] as const;
const mocks = vi.hoisted(() => ({ read: vi.fn(), call: vi.fn(), send: vi.fn() }));
vi.mock("wagmi", () => ({
  usePublicClient: () => ({
    chain: { id: 4663 },
    readContract: mocks.read,
    call: mocks.call,
    getBlockNumber: async () => 100n,
  }),
}));
vi.mock("@/lib/protocol/transactions", () => ({ executeProtocolTransaction: mocks.send }));
const wallet = getAddress(`0x${"9".repeat(40)}`);
const token = getAddress(`0x${"2".repeat(40)}`);
const deployment = {
  descriptor: { deploymentId: "fork", chainId: 4663 },
  contracts: { diamond: getAddress(`0x${"1".repeat(40)}`), statics: token },
  supportedPools: [],
} as unknown as PhaseOneDeployment;
const rows = (count = 1): PositionRewardPortfolio[] =>
  Array.from({ length: count }, (_, index) => ({
    positionId: BigInt(index + 1),
    global: { claimAssets: [token], pendingRewards: [parseEther("3")] },
    globalUnavailable: false,
    discoveryUnavailable: false,
    pools: [],
  }));
function view(values = rows(), address = wallet, props = {}, chainId = 4663) {
  return (
    <WalletContext.Provider
      value={{
        ...defaultWalletState,
        status: "ready",
        address,
        chainId,
        isTargetChain: true,
      }}
    >
      <BatchRewardClaim
        deployment={deployment}
        rows={values}
        loading={false}
        incomplete={false}
        {...props}
      />
    </WalletContext.Provider>
  );
}
beforeEach(() => {
  mocks.read
    .mockReset()
    .mockImplementation(async ({ functionName }) =>
      functionName === "batchClaimLimits" ? [16n, 64n] : true
    );
  mocks.call.mockReset().mockImplementation(async ({ data }) => {
    const decoded = decodeFunctionData({ abi: batchAbi, data });
    if (
      decoded.functionName !== "batchClaimRewards" &&
      decoded.functionName !== "batchClaimRewardsAggregated"
    )
      throw new Error("Wrong call");
    return {
      data: encodeFunctionResult({
        abi: batchAbi,
        functionName: decoded.functionName as "batchClaimRewards" | "batchClaimRewardsAggregated",
        result: [decoded.args[0].map(() => [parseEther("7")]), [], []],
      }),
    };
  });
  mocks.send.mockReset().mockResolvedValue(`0x${"f".repeat(64)}`);
});
describe("Claim all review", () => {
  it("simulates before review and freezes the reviewed receiver and payout", async () => {
    render(view());
    fireEvent.click(screen.getByRole("button", { name: "Claim all" }));
    await screen.findByText("Minimum payout");
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.call.mock.calls[0][0]).toMatchObject({ account: wallet, blockNumber: 100n });
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await screen.findByText("All 1 transactions confirmed.");
    const decoded = decodeFunctionData({
      abi: batchAbi,
      data: mocks.send.mock.calls[0][0].data,
    });
    expect(decoded.functionName).toBe("batchClaimRewardsAggregated");
    if (decoded.functionName === "batchClaimRewardsAggregated") {
      expect(decoded.args[0][0].minimumAmounts).toEqual([parseEther("7")]);
      expect(decoded.args[3].toLowerCase()).toBe(wallet.toLowerCase());
    }
  });
  it("keeps legacy calls on deployments without the aggregated interface", async () => {
    mocks.read.mockImplementation(async ({ functionName }) =>
      functionName === "batchClaimLimits" ? [16n, 64n] : false
    );
    render(view());
    fireEvent.click(screen.getByRole("button", { name: "Claim all" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await screen.findByText("All 1 transactions confirmed.");
    expect(
      decodeFunctionData({ abi: batchAbi, data: mocks.send.mock.calls[0][0].data }).functionName
    ).toBe("batchClaimRewards");
  });
  it("does not retry an aggregated preview failure through legacy claims", async () => {
    mocks.call.mockRejectedValue(new Error("Incompatible aggregated transfer"));
    render(view());
    fireEvent.click(screen.getByRole("button", { name: "Claim all" }));
    await screen.findByText("Incompatible aggregated transfer");
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(
      decodeFunctionData({ abi: batchAbi, data: mocks.call.mock.calls[0][0].data }).functionName
    ).toBe("batchClaimRewardsAggregated");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("shows partial confirmation and stops when a later wallet request fails", async () => {
    mocks.send
      .mockResolvedValueOnce(`0x${"f".repeat(64)}`)
      .mockRejectedValueOnce(new Error("User rejected the transaction"));
    render(view(rows(21)));
    fireEvent.click(screen.getByRole("button", { name: "Claim all" }));
    await screen.findByText("2 transactions · confirm each in your wallet");
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await screen.findByText("User rejected the transaction");
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 transactions confirmed");
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Confirm transaction" })).not.toBeInTheDocument();
  });
  it("clears a reviewed action on wallet or network changes", async () => {
    const { rerender } = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Claim all" }));
    await screen.findByText("Minimum payout");
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    rerender(view(rows(), getAddress(`0x${"8".repeat(40)}`)));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Confirm transaction" })).not.toBeInTheDocument()
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("reports unavailable batch routes without attempting execution", async () => {
    mocks.read.mockRejectedValue(new Error("Selector missing"));
    render(view());
    fireEvent.click(screen.getByRole("button", { name: "Claim all" }));
    await screen.findByText("Batch claims are unavailable on this deployment. Try refreshing.");
    expect(mocks.call).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("discards an obsolete preview when the network changes during preparation", async () => {
    let finish!: (value: { data: `0x${string}` }) => void;
    mocks.call.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { rerender } = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Claim all" }));
    await waitFor(() => expect(mocks.call).toHaveBeenCalledTimes(1));
    rerender(view(rows(), wallet, {}, 1));
    finish({
      data: encodeFunctionResult({
        abi: batchAbi,
        functionName: "batchClaimRewardsAggregated",
        result: [[[parseEther("7")]], [], []],
      }),
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Confirm transaction" })).not.toBeInTheDocument()
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Claim all" })).toBeDisabled();
  });
  it("does not offer a partial claim while discovery is incomplete", () => {
    render(view(rows(), wallet, { incomplete: true }));
    expect(screen.getByRole("button", { name: "Claim all" })).toBeDisabled();
  });
});

describe("batch drawer lifecycle", () => {
  it("stops after the in-flight successful receipt and retains its link", async () => {
    let finish!: (hash: `0x${string}`) => void;
    mocks.send.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    render(view(rows(21)));
    fireEvent.click(screen.getByRole("button", { name: "Claim all" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Stop after current transaction" }));
    finish(`0x${"f".repeat(64)}`);
    await screen.findByRole("link", { name: /Transaction 1 confirmed/ });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Confirm transaction" })).not.toBeInTheDocument();
  });
  it("unmounting while a receipt is in flight prevents subsequent batches", async () => {
    let finish!: (hash: `0x${string}`) => void;
    mocks.send.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { unmount } = render(view(rows(21)));
    fireEvent.click(screen.getByRole("button", { name: "Claim all" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm transaction" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    unmount();
    finish(`0x${"f".repeat(64)}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("clears a pending review when the source or selection scope changes", async () => {
    const { rerender } = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Claim all" }));
    await screen.findByRole("button", { name: "Confirm transaction" });
    rerender(
      view(rows(), wallet, {
        scope: { sources: ["global"], selectedRows: [] },
        scopeKey: "changed",
      })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

it("prepares an automatically opened review only once under StrictMode", async () => {
  render(<StrictMode>{view(rows(), wallet, { autoReview: true, hideTrigger: true })}</StrictMode>);
  await screen.findByRole("button", { name: "Confirm transaction" });
  expect(mocks.call).toHaveBeenCalledTimes(1);
  expect(mocks.send).not.toHaveBeenCalled();
});
