import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DollarOverview, DollarPage } from "@/components/dollar/DollarPage";

describe("Dollar surfaces without a deployment", () => {
  it("allows local action selection without enabling transactions", () => {
    render(<DollarPage />);

    fireEvent.click(screen.getByRole("button", { name: "Recombine" }));
    fireEvent.click(screen.getByRole("button", { name: "WETH" }));
    expect(
      screen
        .getAllByRole("button", { name: "Recombine" })
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
});
