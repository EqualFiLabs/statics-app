import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WalletPage } from "@/components/wallet/WalletPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("wallet interactions", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps funding selection and Portal navigation usable without a runtime", () => {
    const selectFundingNetwork = vi.fn().mockResolvedValue(undefined);
    render(
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          fundingNetworks: [
            { chainId: 8_453, label: "Base", nativeSymbol: "ETH", supportsUniswap: true },
            { chainId: 42_161, label: "Arbitrum", nativeSymbol: "ETH", supportsUniswap: true },
          ],
          selectFundingNetwork,
        }}
      >
        <WalletPage />
      </WalletContext.Provider>
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Network" }), {
      target: { value: "42161" },
    });
    expect(selectFundingNetwork).toHaveBeenCalledWith(42_161);

    fireEvent.click(screen.getByRole("button", { name: /portal/i }));
    expect(screen.getByRole("dialog", { name: "Funding Portal" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Solana" }));
    expect(screen.getByRole("button", { name: "Create Solana wallet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /bridge/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds a catalog token to the wallet and EVM swap selector", () => {
    render(
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          fundingChainId: 8_453,
          fundingNetworkName: "Base",
          fundingNetworks: [
            { chainId: 8_453, label: "Base", nativeSymbol: "ETH", supportsUniswap: true },
          ],
        }}
      >
        <WalletPage />
      </WalletContext.Provider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search tokens" }), {
      target: { value: "AERO" },
    });
    fireEvent.click(screen.getByRole("button", { name: /AERO/ }));

    expect(screen.getByText("Aerodrome Finance")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /portal/i }));
    expect(screen.getAllByRole("option", { name: "AERO" })).toHaveLength(2);
  });
});
