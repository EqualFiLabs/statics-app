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
  it("shows the sample PositionNFT portfolio", () => {
    renderWithoutWallet(<PositionListPage />);
    expect(screen.getByText("Sample PositionNFT portfolio data")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your PositionNFTs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Position #1042" })).toHaveAttribute(
      "href",
      "/app/positions/1042"
    );
  });

  it("shows sample position detail while keeping mutations disabled", () => {
    renderWithoutWallet(<PositionDetailPage positionId={1042n} />);
    expect(screen.getByText("Sample PositionNFT detail data")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Position #1042" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "deposit collateral · Preview only" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Claim selected rewards · Planned" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "withdraw" }));
    fireEvent.click(screen.getByRole("button", { name: "unstake" }));
    expect(
      screen.getByRole("button", { name: "withdraw collateral · Preview only" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "unstake WETH · Preview only" })).toBeDisabled();
  });

  it("shows sample staking and selected rewards while keeping actions disabled", () => {
    renderWithoutWallet(<RewardsPage />);
    expect(screen.getByText("Sample staking and rewards data")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create and stake" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve or create staking position · Preview" })
    ).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Claim multi-asset rewards" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Claim all pending" }));
    expect(screen.getByRole("button", { name: "Claim 4 assets · Preview only" })).toBeDisabled();
  });
});
