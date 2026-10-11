import { beforeEach, expect, it, vi } from "vitest";
import { decodeFunctionData, getAddress, zeroAddress } from "viem";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import { FundIncentivesDialog } from "@/components/liquidity/FundIncentives";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { staticsAbi } from "@statics-protocol/sdk/phase-one";

const mocks = vi.hoisted(() => ({ read: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/protocol/transactions", () => ({ executeProtocolTransaction: mocks.execute }));
vi.mock("wagmi", () => ({ usePublicClient: () => client }));
const client = {
  chain: { id: 4663 },
  readContract: mocks.read,
  getBlock: async () => ({ timestamp: 1_000n }),
};
const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const wallet = address("1"),
  asset = address("2");
const deployment = {
  descriptor: { chainId: 4663, deploymentId: "funding-fixture" },
  contracts: { diamond: address("3") },
} as PhaseOneDeployment;
const token = {
  address: asset,
  symbol: "USD",
  name: "Dollar",
  decimals: 6,
  metadataSource: "reviewed-manifest" as const,
};
const pool = { poolId: `0x${"a".repeat(64)}` as const, token0: token, token1: token };
function show() {
  return render(
    <WalletContext.Provider
      value={{
        ...defaultWalletState,
        status: "ready",
        address: wallet,
        chainId: 4663,
        sendEvmTransaction: vi.fn(),
      }}
    >
      <FundIncentivesDialog
        deployment={deployment}
        pool={pool}
        known={
          new Map([
            [asset.toLowerCase(), token],
            [address("4").toLowerCase(), { ...token, address: address("4"), symbol: "STATICS" }],
          ])
        }
        onClose={vi.fn()}
      />
    </WalletContext.Provider>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.execute.mockResolvedValue(`0x${"b".repeat(64)}`);
  mocks.read.mockImplementation(async ({ functionName }) => {
    if (functionName === "poolRewardConfig")
      return {
        slotCount: 2,
        assets: [address("4"), asset, zeroAddress, zeroAddress, zeroAddress],
        allocatorShareBps: [0, 2500, 0, 0, 0],
      };
    if (functionName === "gaugePool") return { initialized: true, stopped: false };
    if (functionName === "gaugeRewardDuration") return 604800;
    if (functionName === "poolRewardStream")
      return { periodFinish: 2000, periodBudget: 0n, periodEmitted: 0n };
    if (functionName === "balanceOf") return 5_000_000n;
    if (functionName === "allowance") return 0n;
    throw new Error(functionName);
  });
});
it("reviews exact funding and split, then approves before funding with the frozen share", async () => {
  show();
  fireEvent.change(await screen.findByRole("textbox", { name: "USD amount" }), {
    target: { value: "2" },
  });
  const review = await screen.findByRole("button", { name: "Review funding" });
  await waitFor(() => expect(review).toBeEnabled());
  fireEvent.click(review);
  const confirm = await screen.findByRole("button", { name: "Confirm transaction" });
  expect(screen.getByText(/1.5 USD/)).toBeInTheDocument();
  expect(screen.getByText(/0.5 USD/)).toBeInTheDocument();
  fireEvent.click(confirm);
  await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(2));
  const [approval, funding] = mocks.execute.mock.calls.map(([call]) => call);
  expect(approval.kind).toBe("phase-one-approve-token");
  expect(funding.kind).toBe("phase-one-fund-incentives");
  expect(decodeFunctionData({ abi: staticsAbi, data: funding.data }).args).toEqual([
    pool.poolId,
    1,
    2_000_000n,
    0,
    2500,
  ]);
});
it("shows balance failures and prevents funding with an unknown balance", async () => {
  const original = mocks.read.getMockImplementation()!;
  mocks.read.mockImplementation(async (call) => {
    if (call.functionName === "balanceOf") throw new Error("Balance unavailable");
    return original(call);
  });
  show();
  fireEvent.change(await screen.findByRole("textbox", { name: "USD amount" }), {
    target: { value: "2" },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("Balance unavailable");
  expect(screen.getByRole("button", { name: "Review funding" })).toBeDisabled();
  expect(mocks.execute).not.toHaveBeenCalled();
});

it("disables new funding for a stopped gauge", async () => {
  const original = mocks.read.getMockImplementation()!;
  mocks.read.mockImplementation(async (call) =>
    call.functionName === "gaugePool" ? { initialized: true, stopped: true } : original(call)
  );
  show();
  fireEvent.change(await screen.findByRole("textbox", { name: "USD amount" }), {
    target: { value: "2" },
  });
  expect(await screen.findByText(/New incentives are unavailable/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Review funding" })).toBeDisabled();
  expect(mocks.execute).not.toHaveBeenCalled();
});
