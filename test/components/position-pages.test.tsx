import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PositionDetailPage } from "@/components/positions/PositionDetailPage";
import { PositionListPage } from "@/components/positions/PositionListPage";
import { RewardsPage } from "@/components/rewards/RewardsPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

function renderWithoutWallet(ui: React.ReactNode) {
  return render(<WalletContext.Provider value={defaultWalletState}>{ui}</WalletContext.Provider>);
}

describe("position and reward routes without wallet configuration", () => {
  it("uses the shared unavailable state for positions", () => {
    renderWithoutWallet(<PositionListPage />);
    expect(screen.getByText("Statics is not configured")).toBeInTheDocument();
  });

  it("does not render inert position mutations without runtime data", () => {
    renderWithoutWallet(<PositionDetailPage positionId={1042n} />);
    expect(screen.getByText("Statics is not configured")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /collateral|claim|stake/i })
    ).not.toBeInTheDocument();
  });

  it("does not render inert reward transactions without runtime data", () => {
    renderWithoutWallet(<RewardsPage />);
    expect(screen.getByText("Statics is not configured")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve|claim/i })).not.toBeInTheDocument();
  });
});
