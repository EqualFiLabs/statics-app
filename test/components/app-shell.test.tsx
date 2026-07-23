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
  it("labels the development preview without inventing live status", () => {
    renderWithWallet(
      <AppShell>
        <section>Overview body</section>
      </AppShell>
    );

    expect(
      screen.getByRole("heading", { name: "Track your Statics portfolio." })
    ).toBeInTheDocument();
    expect(screen.getByText("Design preview")).toBeInTheDocument();
    expect(screen.getByText("Sample interface", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Sample data only")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getAllByText("Not configured")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /dollar/i })).toHaveAttribute("href", "/app/dollar");
    expect(screen.getByRole("link", { name: /baskets/i })).toHaveAttribute("href", "/app/baskets");
    expect(screen.getByRole("link", { name: /positions/i })).toHaveAttribute(
      "href",
      "/app/positions"
    );
    expect(screen.getByRole("link", { name: /rewards/i })).toHaveAttribute("href", "/app/rewards");
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/app/settings"
    );
    expect(screen.queryByText(/0x[0-9a-f]{8}/i)).not.toBeInTheDocument();
  });

  it("opens and closes the responsive navigation with focus restoration", () => {
    renderWithWallet(<AppShell>Overview</AppShell>);
    const toggle = screen.getByRole("button", {
      name: "Application menu. Current route: Overview",
    });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("DApp navigation")).toHaveClass("is-open");
    expect(screen.getByRole("link", { name: /overview/i })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Close ×" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
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
  it("shows a labelled, inert sample account without wallet configuration", () => {
    renderWithWallet(<WalletSettings />);

    expect(screen.getByText("Sample wallet settings data")).toBeInTheDocument();
    expect(screen.getByText("Connected · Sample")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy sample address" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Review secure export · Preview" })).toBeDisabled();
  });

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
