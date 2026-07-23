import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BasketDetailPage } from "@/components/baskets/BasketDetailPage";
import { BasketListPage } from "@/components/baskets/BasketListPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("basket routes without wallet configuration", () => {
  it("fails closed before initializing wallet-dependent discovery", () => {
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <BasketListPage />
      </WalletContext.Provider>
    );
    expect(
      screen.getByRole("heading", {
        name: "Configure Privy to inspect the local basket deployment.",
      })
    ).toBeInTheDocument();
  });

  it("keeps wallet-dependent detail rendering behind the provider boundary", () => {
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <BasketDetailPage basketId={0n} />
      </WalletContext.Provider>
    );
    expect(
      screen.getByRole("heading", {
        name: "Configure Privy to inspect and use the local basket deployment.",
      })
    ).toBeInTheDocument();
  });
});
