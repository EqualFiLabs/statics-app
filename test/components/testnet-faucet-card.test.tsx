import { fireEvent, render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/dollar/deployment", () => ({
  readClientDollarDeployment: () => ({
    status: "configured",
    deployment: {
      chainId: 46_630,
      faucet: {
        address: `0x${"11".repeat(20)}`,
        runtimeCodeHash: `0x${"22".repeat(32)}`,
      },
      contracts: { dollar: `0x${"66".repeat(20)}` },
      pegged: null,
    },
  }),
  verifyDollarDeployment: vi.fn(),
}));

import { faucetWalletTokens, TestnetFaucetCard } from "@/components/wallet/TestnetFaucetCard";
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
    expect(screen.getByText("Sign in to read the Statics faucet inventory.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the Robinhood Chain faucet ↗" })).toMatchObject({
      href: "https://faucet.testnet.chain.robinhood.com/",
      target: "_blank",
      rel: "noreferrer",
    });
    expect(screen.getByRole("button", { name: "Add all to Wallet" })).toBeDisabled();
  });

  it("offers to switch networks instead of hiding its dedicated page", () => {
    const selectFundingNetwork = vi.fn().mockResolvedValue(undefined);
    render(
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          address: `0x${"33".repeat(20)}`,
          fundingChainId: 8_453,
          fundingWalletOnSelectedChain: true,
          selectFundingNetwork,
        }}
      >
        <TestnetFaucetCard />
      </WalletContext.Provider>
    );

    expect(screen.getByRole("heading", { name: "Testnet asset faucet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Robinhood testnet" }));
    expect(selectFundingNetwork).toHaveBeenCalledWith(46_630);
  });

  it("maps every faucet asset into one wallet token bundle", () => {
    expect(
      faucetWalletTokens([
        {
          address: `0x${"44".repeat(20)}`,
          amount: 10n,
          inventory: 100n,
          walletBalance: 0n,
          symbol: "TSLA",
          name: "Tesla",
          decimals: 18,
        },
        {
          address: `0x${"55".repeat(20)}`,
          amount: 10n,
          inventory: 100n,
          walletBalance: 0n,
          symbol: "PLTR",
          name: "Palantir",
          decimals: 18,
        },
      ])
    ).toEqual([
      {
        address: `0x${"44".repeat(20)}`,
        symbol: "TSLA",
        name: "Tesla",
        decimals: 18,
      },
      {
        address: `0x${"55".repeat(20)}`,
        symbol: "PLTR",
        name: "Palantir",
        decimals: 18,
      },
    ]);
  });
});
