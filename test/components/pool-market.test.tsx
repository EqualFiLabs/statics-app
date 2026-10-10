import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { usePoolMarket } from "@/hooks/usePoolMarket";
import { PoolSummary } from "@/components/liquidity/PoolSummary";

const mocks = vi.hoisted(() => ({
  pools: vi.fn(),
  tokens: vi.fn(),
  depth: vi.fn(),
  candles: vi.fn(),
}));
vi.mock("@/lib/indexer/dex-market", async (original) => ({
  ...(await original<typeof import("@/lib/indexer/dex-market")>()),
  loadDexPools: mocks.pools,
  loadDexTokens: mocks.tokens,
  loadDexDepth: mocks.depth,
}));
vi.mock("@/lib/indexer/phase-one", () => ({ loadPhaseOneCandles: mocks.candles }));
const poolId = `0x${"ab".repeat(32)}` as const;
const token = `0x${"12".repeat(20)}` as const;
const quote = { kind: "weth" as const, address: token, decimals: 18, symbol: "WETH" };
function Market() {
  const market = usePoolMarket("fixture", poolId, [18, 6], "1D");
  return <span data-testid="quote">{String(market.usd(token, 10n ** 18n, 18))}</span>;
}
describe("liquidity market context", () => {
  it("uses the indexed clock for candle windows and never labels WETH valuation as dollars", async () => {
    mocks.pools.mockResolvedValue({ items: [], quote, indexedAtTimestamp: 1000000n });
    mocks.tokens.mockResolvedValue({
      quote,
      items: [{ token: { address: token }, priceNumerator: 10n ** 18n, priceDenominator: 1n }],
    });
    mocks.depth.mockResolvedValue({ indexedAtTimestamp: 1000000n });
    mocks.candles.mockResolvedValue({ items: [] });
    render(<Market />);
    await waitFor(() => expect(mocks.candles).toHaveBeenCalled());
    expect(mocks.candles.mock.calls[0]![0]).toMatchObject({ from: 913600n, to: 1000000n, poolId });
    await waitFor(() => expect(screen.getByTestId("quote")).toHaveTextContent("null"));
  });
  it("renders pool statistics in their own quote currency", () => {
    const stats = {
      valueLocked: 10n ** 18n,
      volume24h: 2n * 10n ** 18n,
      lpFees24h: 3n * 10n ** 18n,
      estimatedYieldBps: null,
      yieldComponents: { complete: true },
    };
    render(
      <PoolSummary
        pair="A / B"
        fee="0.3%"
        current={1}
        unit="A/B"
        series={null}
        stats={stats as never}
        quote={quote}
      />
    );
    expect(screen.getByText("1 WETH")).toBeInTheDocument();
    expect(screen.getByText("2 WETH")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
  it("keeps tiny positive USDG fees visible", () => {
    const stats = {
      valueLocked: 1n,
      volume24h: 2n,
      lpFees24h: 3n,
      estimatedYieldBps: null,
      yieldComponents: { complete: true },
    };
    render(
      <PoolSummary
        pair="A / B"
        fee="0.3%"
        current={1}
        unit="A/B"
        series={null}
        stats={stats as never}
        quote={{ ...quote, kind: "usdg" }}
      />
    );
    expect(screen.getByText(/3.*E-18/)).toBeInTheDocument();
    expect(screen.queryByText("≈ $0.00")).not.toBeInTheDocument();
  });
});
