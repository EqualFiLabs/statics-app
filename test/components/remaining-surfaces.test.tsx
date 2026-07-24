import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BasketCreatePreview,
  LiquidityPreview,
  LoansPreview,
} from "@/components/preview/RemainingSurfacesPreview";

describe("remaining DApp surface previews", () => {
  it("allows local loan selection and mode changes without enabling recovery", () => {
    render(<LoansPreview />);
    fireEvent.click(screen.getAllByRole("button", { name: /loan/i })[1]);
    fireEvent.click(screen.getByRole("button", { name: "recover" }));
    expect(screen.getByRole("button", { name: "Recover collateral" })).toBeDisabled();
  });

  it("moves through the basket draft and disables final creation", () => {
    render(<BasketCreatePreview />);
    fireEvent.click(screen.getByRole("button", { name: /continue to economics/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to review/i }));
    expect(screen.getByRole("button", { name: "Create basket" })).toBeDisabled();
  });

  it("allows local LP selection and mode changes without enabling transactions", () => {
    render(<LiquidityPreview />);
    fireEvent.click(screen.getAllByRole("button", { name: /lp nft/i })[1]);
    fireEvent.click(screen.getByRole("button", { name: "stake" }));
    expect(screen.getByRole("button", { name: "Stake LP NFT" })).toBeDisabled();
  });
});
