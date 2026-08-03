import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/dollar/deployment", () => ({
  readClientDollarDeployment: () => ({
    status: "configured",
    deployment: { chainId: 46_630, faucet: null },
  }),
  verifyDollarDeployment: vi.fn(),
}));

import { TestnetFaucetCard } from "@/components/wallet/TestnetFaucetCard";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("Robinhood testnet faucet surface", () => {
  it("is reachable when Robinhood testnet funding is selected", () => {
    render(
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          fundingChainId: 46_630,
          fundingNetworkName: "Robinhood Testnet",
        }}
      >
        <TestnetFaucetCard />
      </WalletContext.Provider>
    );

    expect(screen.getByRole("heading", { name: "Testnet asset faucet" })).toBeInTheDocument();
    expect(screen.getByText("Faucet deployment has not been recorded yet.")).toBeInTheDocument();
  });

  it("stays hidden on another funding network", () => {
    render(
      <WalletContext.Provider value={{ ...defaultWalletState, fundingChainId: 8_453 }}>
        <TestnetFaucetCard />
      </WalletContext.Provider>
    );

    expect(screen.queryByRole("heading", { name: "Testnet asset faucet" })).not.toBeInTheDocument();
  });
});
