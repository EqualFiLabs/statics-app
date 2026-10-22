import { candidatePoolId, candidatePoolKey } from "@/lib/phase-one/pool-creation";
import { useEffect } from "react";
import { act, fireEvent, render, screen, waitFor } from "@/test/render";
import { beforeEach, expect, it, vi } from "vitest";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { CreatePoolStep } from "@/components/liquidity/CreatePoolStep";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { NewPositionPair, type CreatePoolDraft } from "@/components/liquidity/NewPositionPair";

const mocks = vi.hoisted(() => ({ tokens: vi.fn(), pools: vi.fn() }));
vi.mock("@/lib/indexer/dex-market", async (original) => ({
  ...(await original<typeof import("@/lib/indexer/dex-market")>()),
  loadDexTokens: mocks.tokens,
  loadDexPools: mocks.pools,
}));
vi.mock("@/hooks/usePhaseOneAction", () => ({
  usePhaseOneAction: () => ({
    busy: false,
    ready: false,
    cancel: vi.fn(),
    publicClient: {
      readContract: async ({ functionName }: { functionName: string }) =>
        functionName === "poolRegistration" ? { registered: false } : 1n,
    },
  }),
}));
vi.mock("wagmi", () => ({ usePublicClient: () => null }));
vi.mock("@/components/phase-one/ActionReview", () => ({ ActionReview: () => null }));
const token = (n: number) => ({
  address: `0x${String(n).repeat(40)}` as const,
  symbol: n === 1 ? "SPY" : "NVDA",
  name: "Stock",
  decimals: 18,
  metadataSource: "reviewed-manifest" as const,
});
const deployment = {
  descriptor: { deploymentId: "robinhood-phase-one", chainId: 4663 },
  contracts: { diamond: token(3).address, publicHook: token(4).address },
} as PhaseOneDeployment;
const draft: CreatePoolDraft = {
  tokenA: token(1),
  tokenB: token(2),
  tier: { lpFee: 3000, tickSpacing: 60 },
  staticsFee: { inputPips: 0, outputPips: 0 },
};
let client: QueryClient;
function Subject() {
  const queryClient = useQueryClient();
  useEffect(() => {
    client = queryClient;
  }, [queryClient]);
  return (
    <CreatePoolStep deployment={deployment} draft={draft} onCreated={vi.fn()} onBack={vi.fn()} />
  );
}
const response = (
  flags: { stale?: boolean; halted?: boolean; expiresAt?: number } = {},
  price = 200n
) => ({
  quote: { kind: "usd", address: null, decimals: 18, symbol: "USD" },
  items: [1, 2].map((n) => ({
    token: token(n),
    price: (n === 1 ? price : 100n) * 10n ** 18n,
    priceNumerator: (n === 1 ? price : 100n) * 10n ** 18n,
    priceDenominator: 1n,
    priceFallback: false,
    references: [
      {
        source: "robinhood",
        asset: token(n).address,
        observedAt: Date.now(),
        fetchedAt: Date.now(),
        expiresAt: Date.now() + 900000,
        stale: false,
        halted: false,
        ...flags,
      },
    ],
  })),
});
beforeEach(() => {
  mocks.tokens.mockReset().mockImplementation(async () => response());
});
it("suggests a fresh reference ratio and preserves user input when prices refresh", async () => {
  render(<Subject />);
  const input = screen.getByLabelText("Starting price");
  await waitFor(() => expect(input).toHaveValue("2"));
  expect(mocks.tokens).toHaveBeenCalledWith("robinhood-phase-one", "usd");
  fireEvent.change(input, { target: { value: "7.25" } });
  mocks.tokens.mockImplementation(async () => response({}, 400n));
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["phase-one-dex"] });
  });
  expect(input).toHaveValue("7.25");
});
it.each([{ stale: true }, { halted: true }, { expiresAt: 0 }])(
  "does not suggest from unusable reference prices: %j",
  async (flags) => {
    mocks.tokens.mockImplementation(async () => response(flags));
    render(<Subject />);
    await waitFor(() => expect(mocks.tokens).toHaveBeenCalled());
    expect(screen.getByLabelText("Starting price")).toHaveValue("");
  }
);

it("labels stale and halted TVL in fee-tier creation previews", async () => {
  const poolId = candidatePoolId(
    draft.tokenA.address,
    draft.tokenB.address,
    draft.tier,
    deployment.contracts.publicHook
  );
  const pool = {
    poolId,
    poolKey: candidatePoolKey(
      draft.tokenA.address,
      draft.tokenB.address,
      draft.tier,
      deployment.contracts.publicHook
    ),
    token0: draft.tokenA,
    token1: draft.tokenB,
    enabled: true,
  };
  const d = { ...deployment, supportedPools: [pool] } as PhaseOneDeployment;
  const r = response({ stale: true, halted: true });
  mocks.pools.mockResolvedValue({
    quote: r.quote,
    references: r.items[0]!.references,
    items: [{ poolId, valueLocked: 10n ** 18n }],
  });
  render(
    <NewPositionPair
      deployment={d}
      initialPoolId={poolId}
      canDeposit={() => true}
      onExisting={vi.fn()}
      onCreate={vi.fn()}
    />
  );
  expect(await screen.findByText(/Trading halted/)).toBeInTheDocument();
  expect(screen.getByText(/Stale reference/)).toBeInTheDocument();
  expect(screen.getByText(/\$1/)).toBeInTheDocument();
});
