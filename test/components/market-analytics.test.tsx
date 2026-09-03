import { render, screen } from "@/test/render";
import { describe, expect, it } from "vitest";

import { MarketAnalyticsPanel } from "@/components/overview/DeploymentOverview";
import type { StaticsMarketOverview } from "@/lib/market/types";

const WAD = 10n ** 18n;
const analytics = {
  schemaVersion: 1,
  status: "fresh",
  chainId: 4_663,
  deploymentId: "robinhood-genesis",
  poolId: `0x${"1".repeat(64)}`,
  asOfBlock: "123",
  price: {
    staticsPerWethWad: "250000",
    wethPerStaticsWad: 4_000_000_000_000n.toString(),
    ethUsdWad: (2_500n * WAD).toString(),
    staticsUsdWad: (WAD / 100n).toString(),
  },
  supply: {
    total: (1_000_000_000n * WAD).toString(),
    poolInventory: (100_000_000n * WAD).toString(),
    publicDistributed: (700_000_000n * WAD).toString(),
    unreleasedTreasury: (100_000_000n * WAD).toString(),
    vaultBacking: (117_900_000n * WAD).toString(),
    strictLiquidFloat: (682_100_000n * WAD).toString(),
  },
  valuation: {
    fdvUsdWad: (10_000_000n * WAD).toString(),
    publicMarketCapUsdWad: (7_000_000n * WAD).toString(),
    liquidFloatMarketCapUsdWad: (6_821_000n * WAD).toString(),
  },
  liquidity: {
    principalWeth: (400n * WAD).toString(),
    principalStatics: (100_000_000n * WAD).toString(),
    tvlUsdWad: (2_000_000n * WAD).toString(),
  },
  activity24h: {
    available: true,
    wethVolume: (40n * WAD).toString(),
    staticsVolume: (10_000_000n * WAD).toString(),
    swaps: 12,
    buys: 7,
    sells: 5,
    priceChangeBps: 125,
    highWethPerStaticsWad: 4_400_000_000_000n.toString(),
    lowWethPerStaticsWad: 3_800_000_000_000n.toString(),
    lastWethPerStaticsWad: 4_000_000_000_000n.toString(),
    lastTradeAt: "2026-08-31T00:00:00.000Z",
  },
  depth: {
    buyStatics: [100, 200, 500].map((impact) => ({
      targetImpactBps: impact,
      actualImpactBps: impact - 1,
      inputToken: "WETH" as const,
      outputToken: "STATICS" as const,
      amountIn: WAD.toString(),
      amountOut: (250_000n * WAD).toString(),
      inputUsdWad: (2_500n * WAD).toString(),
    })),
    sellStatics: [100, 200, 500].map((impact) => ({
      targetImpactBps: impact,
      actualImpactBps: impact - 1,
      inputToken: "STATICS" as const,
      outputToken: "WETH" as const,
      amountIn: (250_000n * WAD).toString(),
      amountOut: WAD.toString(),
      inputUsdWad: (2_500n * WAD).toString(),
    })),
  },
  freshness: {
    indexedAt: "2026-08-31T00:00:00.000Z",
    snapshotAt: "2026-08-31T00:00:00.000Z",
    depthAt: "2026-08-31T00:00:00.000Z",
    usdPriceAt: "2026-08-31T00:00:00.000Z",
    usdPriceStale: false,
  },
} satisfies StaticsMarketOverview;

describe("market analytics panel", () => {
  it("separates valuation, supply, pool principal, and executable depth", () => {
    render(<MarketAnalyticsPanel analytics={analytics} loading={false} error={false} />);
    expect(screen.getByText("Public market cap")).toBeInTheDocument();
    expect(screen.getByText("STATICS price")).toBeInTheDocument();
    expect(screen.getByText("24h volume")).toBeInTheDocument();
    expect(screen.getByText("24h high")).toBeInTheDocument();
    expect(screen.getByText("24h low")).toBeInTheDocument();
    expect(screen.getByText("Public distributed supply")).toBeInTheDocument();
    expect(screen.getByText("Strict liquid float")).toBeInTheDocument();
    expect(screen.getByText("Canonical pool principal")).toBeInTheDocument();
    expect(screen.getByText("Executable market depth")).toBeInTheDocument();
    expect(screen.getByText("+1.25% 24h")).toBeInTheDocument();
  });

  it("degrades without hiding the canonical market", () => {
    render(<MarketAnalyticsPanel analytics={null} loading={false} error />);
    expect(
      screen.getByText(/canonical market remains available independently/i)
    ).toBeInTheDocument();
  });
});
