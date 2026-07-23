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
  it("keeps PositionNFT discovery behind the wallet provider boundary", () => {
    renderWithoutWallet(<PositionListPage />);
    expect(
      screen.getByRole("heading", { name: "Configure Privy to inspect local PositionNFTs." })
    ).toBeInTheDocument();
  });

  it("keeps position mutations behind the wallet provider boundary", () => {
    renderWithoutWallet(<PositionDetailPage positionId={1n} />);
    expect(
      screen.getByRole("heading", {
        name: "Configure Privy to inspect and manage local PositionNFTs.",
      })
    ).toBeInTheDocument();
  });

  it("keeps staking and reward reads behind the wallet provider boundary", () => {
    renderWithoutWallet(<RewardsPage />);
    expect(
      screen.getByRole("heading", { name: "Configure Privy to inspect local staking and rewards." })
    ).toBeInTheDocument();
  });
});
