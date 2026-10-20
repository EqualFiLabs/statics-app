import { expect, it } from "vitest";
import { render, screen, within } from "@/test/render";
import { OverviewIncentives } from "@/components/overview/OverviewIncentives";
import type { DexEmissions } from "@/lib/indexer/dex-market";

const token = (n: number, symbol: string, decimals = 18) => ({
  address: `0x${String(n).repeat(40)}` as const,
  symbol,
  decimals,
});
const statics = token(1, "STATICS"),
  usdg = token(2, "USDG", 6);
function data(): DexEmissions {
  return {
    deploymentId: "sample",
    indexedAtBlock: 10n,
    indexedAtTimestamp: 1000000n,
    quote: { ...usdg, kind: "usdg" },
    period: null,
    pools: [],
    othersBps: 10000,
    weeklyIncentives: {
      from: 1000000n,
      until: 1604800n,
      pools: [
        {
          poolId: `0x${"a".repeat(64)}`,
          token0: token(3, "ETH"),
          token1: usdg,
          lp: [
            { token: statics, amount: 700n * 10n ** 18n, quoteValue: 7000000n },
            { token: usdg, amount: 5000000n, quoteValue: 5000000n },
          ],
          allocator: [{ token: statics, amount: 300n * 10n ** 18n, quoteValue: 3000000n }],
          lpPaused: false,
          allocatorPaused: false,
        },
      ],
    },
  };
}
it("shows LP and allocator budgets by token with quote values and the scope explained", () => {
  render(<OverviewIncentives data={data()} loading={false} failed={false} />);
  expect(
    screen.getByRole("heading", { name: "Pool incentives — next 7 days" })
  ).toBeInTheDocument();
  const cells = within(screen.getByRole("row", { name: /ETH \/ USDG/ })).getAllByRole("cell");
  expect(cells[0]).toHaveTextContent("700 STATICS");
  expect(cells[0]).toHaveTextContent("5 USDG");
  expect(cells[1]).toHaveTextContent("300 STATICS");
  expect(screen.getByText(/These are pool totals, not your personal earnings/)).toBeInTheDocument();
});
it("distinguishes paused, unpriced rewards from absent funding", () => {
  const original = data();
  const d = {
    ...original,
    weeklyIncentives: {
      ...original.weeklyIncentives!,
      pools: [
        {
          ...original.weeklyIncentives!.pools[0]!,
          lp: [{ token: statics, amount: 0n, quoteValue: null }],
          lpPaused: true,
          allocator: [],
        },
      ],
    },
  };
  render(<OverviewIncentives data={d} loading={false} failed={false} />);
  expect(screen.getByText("0 STATICS")).toBeInTheDocument();
  expect(screen.getByText("Paused")).toBeInTheDocument();
  expect(screen.getByText("None funded")).toBeInTheDocument();
});
it("does not present an older indexer's missing field as no incentives", () => {
  render(
    <OverviewIncentives
      data={{ ...data(), weeklyIncentives: null }}
      loading={false}
      failed={false}
    />
  );
  expect(screen.getByText("Weekly incentive data is unavailable.")).toBeInTheDocument();
  expect(
    screen.queryByText("No creator-funded incentive streams are scheduled.")
  ).not.toBeInTheDocument();
});
it("keeps the last good snapshot visible and labels failed refreshes", () => {
  render(<OverviewIncentives data={data()} loading={false} failed />);
  expect(screen.getByText("700 STATICS")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Showing the last indexed snapshot");
});
it("shows empty funding separately from loading", () => {
  const d = { ...data(), weeklyIncentives: { ...data().weeklyIncentives!, pools: [] } };
  render(<OverviewIncentives data={d} loading={false} failed={false} />);
  expect(
    screen.getByText("No creator-funded incentive streams are scheduled.")
  ).toBeInTheDocument();
});
