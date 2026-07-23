import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BasketCreatePreview,
  LiquidityPreview,
  LoansPreview,
} from "@/components/preview/RemainingSurfacesPreview";

describe("remaining DApp surface previews", () => {
  it("shows independent loan states and keeps recovery disabled", () => {
    render(<LoansPreview />);
    expect(screen.getByRole("heading", { name: "Position-owned loans" })).toBeInTheDocument();
    expect(screen.getByText("12d 6h remaining")).toBeInTheDocument();
    expect(screen.getByText("Grace ends in 36m")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "recover" }));
    expect(screen.getByRole("heading", { name: "Loan #61" })).toBeInTheDocument();
    expect(screen.getByText(/caller receives no reward/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recover expired tranche · Preview only" })
    ).toBeDisabled();
  });

  it("moves through the basket draft and disables final creation", () => {
    render(<BasketCreatePreview />);
    expect(screen.getByRole("heading", { name: "Create a static basket" })).toBeInTheDocument();
    expect(screen.getByText("Constituents · 4/16")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue to economics/i }));
    expect(screen.getByRole("heading", { name: "Borrowing and flash policy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue to review/i }));
    expect(screen.getByText("Configuration passes local review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create basket · Preview only" })).toBeDisabled();
  });

  it("distinguishes permanent liquidity and user LP NFT actions", () => {
    render(<LiquidityPreview />);
    expect(
      screen.getByRole("heading", { name: "Pools, POL, and user LP NFTs" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("0.00%")).not.toHaveLength(0);
    expect(screen.getByText(/Permanent liquidity is not a user LP position/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "stake" }));
    expect(screen.getByRole("heading", { name: "LP NFT #5012" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stake qualifying LP NFT · Preview only" })
    ).toBeDisabled();
  });
});
