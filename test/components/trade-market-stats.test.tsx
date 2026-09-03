import { render, screen } from "@/test/render";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadSpot: vi.fn() }));

vi.mock("@/lib/market/client", () => ({ loadMarketSpotOverview: mocks.loadSpot }));

import { TradeMarketStats } from "@/components/swap/TradeMarketStats";

const WAD = 10n ** 18n;

beforeEach(() => {
  mocks.loadSpot.mockReset().mockResolvedValue({
    price: { ethUsdWad: (2_500n * WAD).toString() },
    activity24h: {
      wethVolume: (40n * WAD).toString(),
      lastWethPerStaticsWad: "4000000000000",
      highWethPerStaticsWad: "5000000000000",
      lowWethPerStaticsWad: "3000000000000",
    },
    liquidity: { tvlUsdWad: (2_000_000n * WAD).toString() },
  });
});

describe("trade market statistics", () => {
  it("shows the same transaction and liquidity metrics exposed by the public feed", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TradeMarketStats deploymentId="robinhood-genesis" />
      </QueryClientProvider>
    );
    expect(await screen.findByText("0.000004")).toBeInTheDocument();
    expect(screen.getByText("0.000005")).toBeInTheDocument();
    expect(screen.getByText("0.000003")).toBeInTheDocument();
    expect(screen.getByText("24h volume")).toBeInTheDocument();
    expect(screen.getByText("Liquidity")).toBeInTheDocument();
    expect(mocks.loadSpot).toHaveBeenCalledOnce();
  });
});
