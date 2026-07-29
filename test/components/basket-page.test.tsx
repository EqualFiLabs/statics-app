import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BasketDetailPage } from "@/components/baskets/BasketDetailPage";
import { BasketListPage } from "@/components/baskets/BasketListPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("basket routes without wallet configuration", () => {
  it("keeps catalog navigation available", () => {
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <BasketListPage />
      </WalletContext.Provider>
    );
    expect(screen.getAllByRole("link", { name: /inspect basket/i })[0]).toHaveAttribute(
      "href",
      "/app/baskets/0"
    );
  });

  it("allows local mode selection without enabling transactions", () => {
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <BasketDetailPage basketId={0n} />
      </WalletContext.Provider>
    );
    expect(screen.getByRole("button", { name: "Mint basket" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /redeem/i }));
    expect(screen.getByRole("button", { name: "Redeem basket" })).toBeDisabled();
  });
});
