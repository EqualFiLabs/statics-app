import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LoansPage } from "@/components/loans/LoansPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("loans page", () => {
  it("allows local mode selection without enabling loan transactions", async () => {
    const user = userEvent.setup();
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <LoansPage />
      </WalletContext.Provider>
    );

    expect(screen.getByRole("button", { name: "Borrow" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "recover" }));
    expect(screen.getByRole("button", { name: "Recover collateral" })).toBeDisabled();
  });
});
