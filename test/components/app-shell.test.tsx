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

  it("explains the mismatch and names the chain the wallet is actually on", () => {
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "ready",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: 1,
      targetChainId: 31_337,
      networkName: "Anvil",
      isTargetChain: false,
    });

    expect(screen.getByText(/wrong network/i)).toBeInTheDocument();
    expect(screen.getByText(/switch to Anvil/i)).toBeInTheDocument();
    expect(screen.getByText(/chain 31337/i)).toBeInTheDocument();
    // The indicator reports the id, because the context carries no name for
    // whichever chain the wallet actually sits on.
    expect(screen.getByText("Chain 1")).toBeInTheDocument();
  });

  it("names the network and offers no switch once the wallet is on target", () => {
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "ready",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: 31_337,
      targetChainId: 31_337,
      networkName: "Anvil",
      isTargetChain: true,
    });

    // Scoped to the indicator so this cannot pass on some other mention.
    expect(document.querySelector(".dapp-network")).toHaveTextContent("Anvil");
    expect(screen.queryByRole("button", { name: "Switch network" })).not.toBeInTheDocument();
    expect(screen.queryByText(/wrong network/i)).not.toBeInTheDocument();
  });

  it("shows the target network before a wallet is connected", () => {
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "signed-out",
      networkName: "Anvil",
      targetChainId: 31_337,
    });

    expect(document.querySelector(".dapp-network")).toHaveTextContent("Anvil");
    expect(screen.queryByText(/wrong network/i)).not.toBeInTheDocument();
  });
});

describe("wallet settings", () => {
  it("warns before embedded-wallet export and exposes logout", () => {
    const exportWallet = vi.fn().mockResolvedValue(undefined);
    const logout = vi.fn().mockResolvedValue(undefined);
    renderWithWallet(<WalletSettings previewMode={false} />, {
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
    renderWithWallet(<WalletSettings previewMode={false} />, {
      status: "ready",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletKind: "external",
    });

    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
  });
});
