import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DollarOverview, DollarPage } from "@/components/dollar/DollarPage";

describe("Dollar surfaces without a deployment", () => {
  it("renders a clearly labelled local design preview with actions disabled", () => {
    render(<DollarPage />);
    expect(screen.getByText("Sample Dollar data")).toBeInTheDocument();
    expect(screen.getByText("12,480.52")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview only · connect local deployment" })
    ).toBeDisabled();
  });

  it("shows a populated sample portfolio on the overview", () => {
    render(<DollarOverview />);
    expect(screen.getByText("Sample portfolio data")).toBeInTheDocument();
    expect(screen.getByText("12,480.52 Dollar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review positions →" })).toHaveAttribute(
      "href",
      "/app/positions"
    );
  });
});
