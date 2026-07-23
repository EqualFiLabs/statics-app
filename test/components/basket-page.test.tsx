import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BasketDetailPage } from "@/components/baskets/BasketDetailPage";
import { BasketListPage } from "@/components/baskets/BasketListPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("basket routes without wallet configuration", () => {
  it("shows the sample catalog without initializing wallet-dependent discovery", () => {
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <BasketListPage />
      </WalletContext.Provider>
    );
    expect(screen.getByText("Sample basket catalog data")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Statics baskets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dollar Reserve/ })).toHaveAttribute(
      "href",
      "/app/baskets/0"
    );
  });

  it("shows sample basket detail while keeping transactions disabled", () => {
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <BasketDetailPage basketId={0n} />
      </WalletContext.Provider>
    );
    expect(screen.getByText("Sample basket detail data")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dollar Reserve" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview only · transaction disabled" })
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Redeem" }));
    expect(screen.getByText("4 constituent outputs")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview only · transaction disabled" })
    ).toBeDisabled();
  });
});
