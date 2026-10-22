import { act, fireEvent, render, screen, waitFor } from "@/test/render";
import { beforeEach, expect, it, vi } from "vitest";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { CreatePoolStep } from "@/components/liquidity/CreatePoolStep";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { CreatePoolDraft } from "@/components/liquidity/NewPositionPair";

const mocks = vi.hoisted(() => ({ tokens: vi.fn() }));
vi.mock("@/lib/indexer/dex-market", async (original) => ({
  ...(await original<typeof import("@/lib/indexer/dex-market")>()),
  loadDexTokens: mocks.tokens,
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
  client = useQueryClient();
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
