import { fireEvent, render, screen, within } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WalletPage } from "@/components/wallet/WalletPage";
import { DEFAULT_SOLANA_TOKENS, saveSolanaTokens } from "@/lib/solana-tokens";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("wallet interactions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("opens and closes the canonical Portal from URL state", () => {
    window.history.replaceState(null, "", "/app/wallet?modal=portal");
    render(<WalletPage />);

    expect(screen.getByRole("dialog", { name: "Funding Portal" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Funding Portal" })).not.toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

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
    const portal = screen.getByRole("dialog", { name: "Funding Portal" });
    expect(portal).toBeInTheDocument();
    fireEvent.click(within(portal).getByRole("button", { name: "Solana" }));
    expect(
      within(portal).getByRole("button", { name: "Create Solana wallet" })
    ).toBeInTheDocument();
    fireEvent.click(within(portal).getByRole("tab", { name: /bridge/i }));
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

  it("reveals removal controls only while Remove mode is active", () => {
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

    expect(screen.queryByRole("button", { name: "Remove AERO" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove AERO" }));

    expect(screen.queryByText("Aerodrome Finance")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });

  it("keeps the Solana wallet surface navigable without RPC data", () => {
    render(<WalletPage />);
    fireEvent.click(screen.getByRole("button", { name: "Solana" }));
    expect(screen.getByRole("heading", { name: "Tokens" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Portal" }));
    const portal = screen.getByRole("dialog", { name: "Funding Portal" });
    expect(within(portal).getByRole("button", { name: "Solana" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      within(portal).getByRole("button", { name: "Create Solana wallet" })
    ).toBeInTheDocument();
    fireEvent.click(within(portal).getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: /Add token/ }));
    expect(screen.getByRole("dialog", { name: "Browse Solana tokens" })).toBeInTheDocument();
  });

  it("reveals Solana removal controls only for added tokens", () => {
    saveSolanaTokens([
      ...DEFAULT_SOLANA_TOKENS,
      {
        mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
        symbol: "JUP",
        name: "Jupiter",
        decimals: 6,
      },
    ]);
    render(<WalletPage />);
    fireEvent.click(screen.getByRole("button", { name: "Solana" }));

    expect(screen.queryByRole("button", { name: "Remove JUP" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove JUP" }));

    expect(screen.queryByText("Jupiter")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });

  it("keeps the faucet on its dedicated account route", () => {
    render(<WalletPage />);
    expect(screen.queryByRole("heading", { name: "Testnet asset faucet" })).not.toBeInTheDocument();
  });
});
