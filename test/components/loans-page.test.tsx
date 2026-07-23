import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LoansPage } from "@/components/loans/LoansPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("loans page", () => {
  it("keeps the approved local loan workspace visible before deployment configuration", async () => {
    const user = userEvent.setup();
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <LoansPage />
      </WalletContext.Provider>
    );

    expect(screen.getByText("Sample loan portfolio data")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Position-owned loans" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Borrow principal vector · Preview only" })
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "recover" }));
    expect(screen.getByText(/caller receives no reward/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recover expired tranche · Preview only" })
    ).toBeDisabled();
  });
});
