import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DollarOverviewPreview, RewardsPreview } from "@/components/preview/DappPreview";
import { overviewTiles } from "@/lib/overview";

/**
 * The preview is the only way to review surfaces that otherwise need a
 * connected wallet, which makes it worthless the moment it stops matching the
 * app. It had already drifted: section headings and a reward legend renamed in
 * the app were still showing here, and the overview offered tiles the connected
 * version no longer had.
 *
 * These pin the parts that drifted. They are structural on purpose -- the
 * preview shows unavailable data, so there are no values to compare, and the
 * regressions worth catching here were layout and labelling.
 */
describe("overview preview", () => {
  it("offers the same tiles as the connected overview", () => {
    render(<DollarOverviewPreview />);
    for (const tile of overviewTiles) {
      expect(screen.getByText(tile.label), tile.id).toBeInTheDocument();
      expect(screen.getByRole("link", { name: `${tile.action} →` })).toHaveAttribute(
        "href",
        tile.href
      );
    }
  });

  it("shows the earned figure, which is the reason to hold a basket", () => {
    render(<DollarOverviewPreview />);
    expect(screen.getByText("Earned by your baskets")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Claim" })).toHaveAttribute("href", "/app/rewards");
  });
});

describe("rewards preview", () => {
  it("covers all three earning mechanisms, each naming its own", () => {
    render(<RewardsPreview />);
    expect(screen.getByText("Basket rewards")).toBeInTheDocument();
    expect(screen.getByText("Stake Statics to earn")).toBeInTheDocument();
    expect(screen.getByText("Your staked positions")).toBeInTheDocument();
    expect(screen.getAllByText("From staking Statics")).toHaveLength(2);
    expect(screen.getByText("From your deposited baskets")).toBeInTheDocument();
  });

  it("drives the real reward picker rather than restating its markup", () => {
    // The hand-copied version still showed the old legend after the app's had
    // been rewritten as a question.
    render(<RewardsPreview />);
    expect(screen.getByText(/what do you want to earn/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not earn you a share of fees collected before then/i)
    ).toBeInTheDocument();
  });

  it("reproduces the full-width staked panel, not a column", () => {
    // The layout bug this preview exists to surface: a list panel left at half
    // width strands the rest of the row.
    const { container } = render(<RewardsPreview />);
    const panels = container.querySelectorAll(".rewards-page > .position-panel");
    expect(panels).toHaveLength(3);
    const staked = [...panels].find((panel) =>
      within(panel as HTMLElement).queryByText("Your staked positions")
    );
    expect(staked).toHaveClass("is-wide");
  });
});
