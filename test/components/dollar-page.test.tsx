import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DollarOverview, DollarPage, DollarProfilePills } from "@/components/dollar/DollarPage";

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
});
