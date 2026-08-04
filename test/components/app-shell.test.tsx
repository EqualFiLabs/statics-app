import { fireEvent, render, screen, within } from "@/test/render";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell/AppShell";
import { WalletContext, defaultWalletState, type WalletState } from "@/providers/wallet-context";
import english from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ refresh: vi.fn() }),
}));

function renderWithWallet(ui: React.ReactNode, overrides: Partial<WalletState> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={english}>
      <WalletContext.Provider value={{ ...defaultWalletState, ...overrides }}>
        {ui}
      </WalletContext.Provider>
    </NextIntlClientProvider>
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
      status: "disconnected",
      identityStatus: "signed-out",
      login,
      connectWallet,
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(login).toHaveBeenCalledOnce();
    expect(connectWallet).toHaveBeenCalledOnce();
  });

  it("keeps direct wallet connection available while Privy is degraded", () => {
    const connectWallet = vi.fn();
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "disconnected",
      identityStatus: "degraded",
      identityError: "Privy sessions are unavailable.",
      connectWallet,
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(connectWallet).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("connects a listed external wallet without invoking Privy login", () => {
    const connectWalletOption = vi.fn().mockResolvedValue(undefined);
    const login = vi.fn();
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "disconnected",
      identityStatus: "degraded",
      walletPickerOpen: true,
      walletOptions: [{ id: "metamask", name: "MetaMask", kind: "external", connected: false }],
      connectWalletOption,
      login,
    });

    expect(screen.getByText(/external EVM wallets connect directly/i)).toBeInTheDocument();
    expect(screen.getByText(/Privy is temporarily unavailable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /MetaMask.*External wallet/i }));
    expect(connectWalletOption).toHaveBeenCalledWith("metamask");
    expect(login).not.toHaveBeenCalled();
  });

  it("shows the active address and requires a network switch when mismatched", () => {
    const switchNetwork = vi.fn().mockResolvedValue(undefined);
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "ready",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletKind: "embedded",
      chainId: 1,
      isTargetChain: false,
      switchNetwork,
    });

    expect(screen.getByRole("button", { name: "0x1234…5678" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch network" }));
    expect(switchNetwork).toHaveBeenCalledOnce();
  });

  // The pill used to copy silently on click, which gave no way to reach the
  // Solana address or to sign out.
  it("opens an account dialog from the address pill", () => {
    const disconnectWallet = vi.fn().mockResolvedValue(undefined);
    const signOut = vi.fn().mockResolvedValue(undefined);
    const address = "0x1234567890abcdef1234567890abcdef12345678";
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "ready",
      authenticated: true,
      address,
      walletKind: "embedded",
      chainId: 31_337,
      networkName: "Anvil",
      isTargetChain: true,
      explorerUrl:
        "https://explorer.testnet.chain.robinhood.com/address/0x1234567890abcdef1234567890abcdef12345678",
      disconnectWallet,
      signOut,
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "0x1234…5678" }));

    const dialog = screen.getByRole("dialog", { name: "Your account" });
    expect(dialog).toBeInTheDocument();
    // Both chains are named, and the full address is shown rather than the
    // truncation from the pill.
    expect(screen.getByText("Ethereum")).toBeInTheDocument();
    expect(screen.getByText("Solana")).toBeInTheDocument();
    expect(screen.getByText(address)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Ethereum address" })).toBeInTheDocument();
    expect(within(dialog).getByText("Embedded wallet")).toBeInTheDocument();
    expect(within(dialog).getByText("Anvil")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view ethereum account/i })).toHaveAttribute(
      "rel",
      "noreferrer"
    );
    expect(screen.getByText(/exporting reveals recovery material/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Disconnect wallet" }));
    expect(disconnectWallet).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();
  });

  // No Solana wallet exists until a Solana route is used, so the row has to say
  // so rather than offering a copy control for nothing.
  it("explains the absent Solana address instead of offering an empty copy", () => {
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "ready",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletKind: "embedded",
      chainId: 31_337,
      isTargetChain: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "0x1234…5678" }));
    expect(screen.getByText(/No Solana wallet yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Solana address" })).not.toBeInTheDocument();
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
      status: "disconnected",
      networkName: "Anvil",
      targetChainId: 31_337,
    });

    expect(document.querySelector(".dapp-network")).toHaveTextContent("Anvil");
    expect(screen.queryByText(/wrong network/i)).not.toBeInTheDocument();
  });

  it("exports embedded wallets from the account dialog", () => {
    const exportWallet = vi.fn().mockResolvedValue(undefined);
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "ready",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletKind: "embedded",
      explorerUrl:
        "https://explorer.testnet.chain.robinhood.com/address/0x1234567890abcdef1234567890abcdef12345678",
      exportWallet,
    });

    fireEvent.click(screen.getByRole("button", { name: "0x1234…5678" }));
    expect(screen.getByText(/exporting reveals recovery material/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review secure export" }));
    expect(exportWallet).toHaveBeenCalledOnce();
  });

  it("does not offer private-key export for an external wallet", () => {
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "ready",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletKind: "external",
    });

    fireEvent.click(screen.getByRole("button", { name: "0x1234…5678" }));
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
  });

  it("keeps Privy sign-out separate from wallet disconnect", () => {
    const disconnectWallet = vi.fn().mockResolvedValue(undefined);
    const signOut = vi.fn().mockResolvedValue(undefined);
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "ready",
      identityStatus: "authenticated",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletKind: "external",
      disconnectWallet,
      signOut,
    });

    fireEvent.click(screen.getByRole("button", { name: "0x1234…5678" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out of Privy" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(disconnectWallet).not.toHaveBeenCalled();
  });

  it("allows wallet disconnect while a Privy sign-out request is still pending", () => {
    const disconnectWallet = vi.fn().mockResolvedValue(undefined);
    renderWithWallet(<AppShell>Overview</AppShell>, {
      status: "ready",
      identityStatus: "authenticated",
      authenticated: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletKind: "external",
      busyAction: "sign-out",
      identityBusyAction: "sign-out",
      walletBusyAction: null,
      disconnectWallet,
    });

    fireEvent.click(screen.getByRole("button", { name: "0x1234…5678" }));
    const disconnect = screen.getByRole("button", { name: "Disconnect wallet" });
    expect(disconnect).toBeEnabled();
    expect(screen.getByRole("button", { name: "Signing out of Privy…" })).toBeDisabled();
    fireEvent.click(disconnect);
    expect(disconnectWallet).toHaveBeenCalledOnce();
  });
});
