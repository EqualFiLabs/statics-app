import { beforeEach, expect, it, vi } from "vitest";
import { decodeFunctionData, getAddress } from "viem";
import { staticsRangeGaugeAbi } from "@statics-protocol/sdk/phase-one";
import { fireEvent, render, screen, within } from "@/test/render";
import { CreatorPoolsPage } from "@/components/liquidity/CreatorPools";

const mocks = vi.hoisted(() => ({
  assigned: [] as {
    slot: number;
    asset: `0x${string}`;
    allocatorShareBps: number;
    remaining: bigint;
    periodFinish: bigint;
  }[],
  allowed: [] as { address: `0x${string}`; symbol: string; name: string; decimals: number }[],
  prepare: vi.fn(),
  send: vi.fn(),
}));
const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const wallet = address("1");
const statics = { address: address("a"), symbol: "STATICS", name: "Statics", decimals: 18 };
const usdg = { address: address("3"), symbol: "USDG", name: "Global Dollar", decimals: 6 };
const pool = {
  poolId: `0x${"a".repeat(64)}`,
  poolKey: { currency0: statics.address, currency1: usdg.address, fee: 200 },
  token0: statics,
  token1: usdg,
};
const deployment = {
  descriptor: { deploymentId: "reward-picker-fixture", chainId: 4663 },
  contracts: { diamond: address("4") },
};
const tokens = new Map([statics, usdg].map((token) => [token.address.toLowerCase(), token]));
vi.mock("wagmi", () => ({ usePublicClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/providers/deployment-context", () => ({
  useDeployment: () => ({ active: { phaseOne: deployment } }),
}));
vi.mock("@/hooks/usePhaseOnePools", () => ({
  usePhaseOnePools: () => ({ pools: [pool], discovering: false }),
}));
vi.mock("@/hooks/usePhaseOneAction", () => ({
  usePhaseOneAction: () => ({
    ready: true,
    wallet,
    publicClient: {},
    busy: false,
    prepare: mocks.prepare,
    send: mocks.send,
    cancel: vi.fn(),
  }),
}));
vi.mock("@/components/phase-one/ActionReview", () => ({ ActionReview: () => null }));
vi.mock("@/components/common/IndexedPoolSwapFee", () => ({ IndexedPoolSwapFee: () => null }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    let data;
    if (queryKey[0] === "phase-one-pools") data = { items: [{ ...pool, creator: wallet }] };
    else if (queryKey[2] === "pools")
      data = {
        loaded: [
          {
            pool,
            state: {
              creator: wallet,
              pendingCreator: null,
              recipient: wallet,
              pending: [],
              settled: [],
              polActivated: true,
              polFee: 0n,
            },
          },
        ],
        tokens,
        failures: [],
      };
    else if (queryKey[2] === "rewards")
      data = {
        rewards: mocks.assigned,
        tokens,
        rewardDuration: 604800n,
        now: 1000n,
        fundingEnabled: true,
      };
    else if (queryKey[2] === "allowed-rewards") data = mocks.allowed;
    else throw new Error("Unexpected query " + queryKey.join(":"));
    return { data, isSuccess: true, isLoading: false };
  },
}));
const slot = (index: number, asset = statics.address) => ({
  slot: index,
  asset,
  allocatorShareBps: 0,
  remaining: 0n,
  periodFinish: 0n,
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.assigned = [slot(0)];
  mocks.allowed = [statics, usdg];
});
it("offers approved STATICS alongside its protocol slot and prepares the append call", async () => {
  render(<CreatorPoolsPage />);
  const choices = screen.getByRole("group", { name: "Choose an approved token" });
  fireEvent.click(within(choices).getByRole("button", { name: "STATICS" }));
  fireEvent.click(screen.getByRole("button", { name: "Add token" }));
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
  const review = await mocks.prepare.mock.calls[0][0]();
  await review.execute();
  const call = mocks.send.mock.calls[0][0];
  expect(call.to).toBe(deployment.contracts.diamond);
  expect(decodeFunctionData({ abi: staticsRangeGaugeAbi, data: call.data })).toMatchObject({
    functionName: "appendPoolRewardAsset",
    args: [pool.poolId, statics.address],
  });
});
it("excludes STATICS after it has a creator-funded slot", () => {
  mocks.assigned = [slot(0), slot(1, statics.address.toLowerCase() as `0x${string}`)];
  render(<CreatorPoolsPage />);
  const choices = screen.getByRole("group", { name: "Choose an approved token" });
  expect(within(choices).queryByRole("button", { name: "STATICS" })).not.toBeInTheDocument();
  expect(within(choices).getByRole("button", { name: "USDG" })).toBeInTheDocument();
});
it("continues excluding other already-assigned tokens", () => {
  mocks.assigned = [slot(0), slot(1, usdg.address)];
  render(<CreatorPoolsPage />);
  const choices = screen.getByRole("group", { name: "Choose an approved token" });
  expect(within(choices).getByRole("button", { name: "STATICS" })).toBeInTheDocument();
  expect(within(choices).queryByRole("button", { name: "USDG" })).not.toBeInTheDocument();
});
it("does not bypass the onchain token policy", () => {
  mocks.allowed = [usdg];
  render(<CreatorPoolsPage />);
  const choices = screen.getByRole("group", { name: "Choose an approved token" });
  expect(within(choices).queryByRole("button", { name: "STATICS" })).not.toBeInTheDocument();
});
it("keeps the five-slot limit", () => {
  mocks.assigned = [
    slot(0),
    slot(1, usdg.address),
    slot(2, address("5")),
    slot(3, address("6")),
    slot(4, address("7")),
  ];
  render(<CreatorPoolsPage />);
  expect(screen.getByText("This pool has all 5 reward tokens.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add token" })).not.toBeInTheDocument();
});
