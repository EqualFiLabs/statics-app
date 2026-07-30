import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BasketDetailPage } from "@/components/baskets/BasketDetailPage";
import { BasketListPage } from "@/components/baskets/BasketListPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("basket routes without wallet configuration", () => {
  it("uses the shared unavailable state for the catalog", () => {
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <BasketListPage />
      </WalletContext.Provider>
    );
    expect(screen.getByText("Statics is not configured")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /inspect basket/i })).not.toBeInTheDocument();
  });

  it("does not render inert basket controls without runtime data", () => {
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <BasketDetailPage basketId={0n} />
      </WalletContext.Provider>
    );
    expect(screen.getByText("Statics is not configured")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mint|redeem/i })).not.toBeInTheDocument();
  });
});
