import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PositionDetailPage } from "@/components/positions/PositionDetailPage";
import { PositionListPage } from "@/components/positions/PositionListPage";
import { RewardsPage } from "@/components/rewards/RewardsPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

function renderWithoutWallet(ui: React.ReactNode) {
  return render(<WalletContext.Provider value={defaultWalletState}>{ui}</WalletContext.Provider>);
}

describe("position and reward routes without wallet configuration", () => {
  it("keeps PositionNFT detail navigation available", () => {
    renderWithoutWallet(<PositionListPage />);
    expect(screen.getAllByRole("link", { name: /manage position/i })[0]).toHaveAttribute(
      "href",
      "/app/positions/0"
    );
  });

  it("allows local mode selection without enabling position mutations", () => {
    renderWithoutWallet(<PositionDetailPage positionId={1042n} />);
    expect(screen.getByRole("button", { name: "deposit collateral" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Claim selected rewards" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "withdraw" }));
    fireEvent.click(screen.getByRole("button", { name: "unstake" }));
    expect(screen.getByRole("button", { name: "withdraw collateral" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "unstake WETH" })).toBeDisabled();
  });

  it("keeps reward transactions disabled without runtime data", () => {
    renderWithoutWallet(<RewardsPage />);
    expect(
      screen.getByRole("button", { name: "Approve or create staking position" })
    ).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Claim selected rewards" })[0]).toBeDisabled();
  });
});
