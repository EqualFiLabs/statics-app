import { render, screen } from "@/test/render";
import { describe, expect, it } from "vitest";

import { LoansPage } from "@/components/loans/LoansPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("loans page", () => {
  it("does not render inert loan controls without runtime data", () => {
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <LoansPage />
      </WalletContext.Provider>
    );

    expect(screen.getByText("Statics is not configured")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /borrow|recover/i })).not.toBeInTheDocument();
  });
});
