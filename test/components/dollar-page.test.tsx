import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DollarOverview, DollarPage } from "@/components/dollar/DollarPage";

describe("Dollar surfaces without a deployment", () => {
  it("keeps public-network actions unavailable without verified addresses", () => {
    render(<DollarPage />);
    expect(
      screen.getByRole("heading", { name: "No verified deployment is configured." })
    ).toBeInTheDocument();
    expect(screen.getByText(/Robinhood Testnet actions remain disabled/)).toBeInTheDocument();
  });

  it("shows the same honest state on the overview", () => {
    render(<DollarOverview />);
    expect(screen.getByText("Dollar unavailable")).toBeInTheDocument();
  });
});
