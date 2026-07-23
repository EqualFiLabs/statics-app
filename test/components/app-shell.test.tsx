import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell/AppShell";
import { WalletSettings } from "@/components/app-shell/WalletSettings";
import { WalletContext, defaultWalletState, type WalletState } from "@/providers/wallet-context";

function renderWithWallet(ui: React.ReactNode, overrides: Partial<WalletState> = {}) {
  return render(
    <WalletContext.Provider value={{ ...defaultWalletState, ...overrides }}>
      {ui}
    </WalletContext.Provider>
  );
}

describe("DApp wallet shell", () => {
  it("shows honest missing configuration without inventing an address", () => {
    renderWithWallet(
      <AppShell>
        <section>Overview body</section>
      </AppShell>
    );

    expect(
      screen.getByRole("heading", { name: "Wallet access, without shared sessions." })
    ).toBeInTheDocument();
    expect(screen.getByText("Wallet foundation", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getAllByText("Not configured")).toHaveLength(1);
    expect(screen.getByText("Dollar")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/app/settings"
    );
    expect(screen.queryByText(/0x[0-9a-f]{8}/i)).not.toBeInTheDocument();
  });

  it("offers independent Privy sign-in and external wallet connection", () => {
    const login = vi.fn();
    const connectWallet = vi.fn();
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "signed-out",
      login,
      connectWallet,
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(login).toHaveBeenCalledOnce();
    expect(connectWallet).toHaveBeenCalledOnce();
    expect(screen.getByText("Signed out")).toBeInTheDocument();
  });

  it("shows the active address and requires a network switch when mismatched", () => {
    const copyAddress = vi.fn().mockResolvedValue(undefined);
    const switchNetwork = vi.fn().mockResolvedValue(undefined);
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "ready",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletKind: "embedded",
      chainId: 1,
      isTargetChain: false,
      copyAddress,
      switchNetwork,
    });

    fireEvent.click(screen.getByRole("button", { name: "0x1234…5678" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch network" }));
    expect(copyAddress).toHaveBeenCalledOnce();
    expect(switchNetwork).toHaveBeenCalledOnce();
  });
});

describe("wallet settings", () => {
  it("warns before embedded-wallet export and exposes logout", () => {
    const exportWallet = vi.fn().mockResolvedValue(undefined);
    const logout = vi.fn().mockResolvedValue(undefined);
    renderWithWallet(<WalletSettings />, {
      status: "ready",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletKind: "embedded",
      explorerUrl:
        "https://explorer.testnet.chain.robinhood.com/address/0x1234567890abcdef1234567890abcdef12345678",
      exportWallet,
      logout,
    });

    expect(screen.getByText(/exporting reveals recovery material/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review secure export" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out of Statics" }));
    expect(exportWallet).toHaveBeenCalledOnce();
    expect(logout).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: /view on explorer/i })).toHaveAttribute(
      "rel",
      "noreferrer"
    );
  });

  it("does not offer private-key export for an external wallet", () => {
    renderWithWallet(<WalletSettings />, {
      status: "ready",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletKind: "external",
    });

    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
  });
});
