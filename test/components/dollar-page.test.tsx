import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DollarOverview,
  DollarPage,
  DollarProfileContent,
  DollarProfilePills,
} from "@/components/dollar/DollarPage";

describe("Dollar surfaces without a deployment", () => {
  it("does not render inert Dollar controls", () => {
    render(<DollarPage />);

    expect(screen.getByText("Statics is not configured")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /deposit|redeem|recombine/i })
    ).not.toBeInTheDocument();
  });

  it("uses the same unavailable boundary for the portfolio", () => {
    render(<DollarOverview />);
    expect(screen.getByText("Statics is not configured")).toBeInTheDocument();
  });

  it("offers USDG as the third collateral profile", () => {
    const onChange = vi.fn();
    render(<DollarProfilePills value="ETH" peggedAvailable disabled={false} onChange={onChange} />);

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "ETH",
      "WETH",
      "USDG",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "USDG" }));
    expect(onChange).toHaveBeenCalledWith("USDG");
  });

  it("renders only the controls for the selected collateral profile", () => {
    const { rerender } = render(
      <DollarProfileContent
        profile="USDG"
        volatile={<button type="button">Deposit WETH</button>}
        pegged={<button type="button">Deposit USDG</button>}
      />
    );

    expect(screen.getByRole("button", { name: "Deposit USDG" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deposit WETH" })).not.toBeInTheDocument();

    rerender(
      <DollarProfileContent
        profile="WETH"
        volatile={<button type="button">Deposit WETH</button>}
        pegged={<button type="button">Deposit USDG</button>}
      />
    );

    expect(screen.getByRole("button", { name: "Deposit WETH" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deposit USDG" })).not.toBeInTheDocument();
  });
});
