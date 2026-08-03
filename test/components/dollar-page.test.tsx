import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DollarOverview,
  DollarPage,
  DollarProfileContent,
  DollarProfilePills,
} from "@/components/dollar/DollarPage";

describe("Dollar surfaces without a deployment", () => {
  it("allows local action selection without enabling transactions", () => {
    render(<DollarPage />);

    fireEvent.click(screen.getByRole("button", { name: "Recombine" }));
    fireEvent.click(screen.getByRole("button", { name: "WETH" }));
    fireEvent.click(screen.getByRole("button", { name: "USDG" }));
    expect(screen.getByRole("button", { name: "Redeem" })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("button", { name: "Deposit" })
        .filter((button) => button.hasAttribute("disabled"))
    ).toHaveLength(1);
  });

  it("keeps portfolio navigation available", () => {
    render(<DollarOverview />);
    expect(screen.getByRole("link", { name: "Review positions →" })).toHaveAttribute(
      "href",
      "/app/positions"
    );
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
