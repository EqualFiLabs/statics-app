import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PeggedDollarPanel } from "@/components/portal/PeggedDollarPanel";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("pegged Dollar wallet states", () => {
  it("creates an embedded wallet before attempting a chain switch", () => {
    const createWallet = vi.fn().mockResolvedValue(undefined);
    const switchNetwork = vi.fn().mockResolvedValue(undefined);
    render(
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "wallet-missing",
          authenticated: true,
          createWallet,
          switchNetwork,
        }}
      >
        <PeggedDollarPanel />
      </WalletContext.Provider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Create embedded wallet" }));
    expect(createWallet).toHaveBeenCalledOnce();
    expect(switchNetwork).not.toHaveBeenCalled();
  });

  it("keeps loading state inert", () => {
    render(
      <WalletContext.Provider value={{ ...defaultWalletState, status: "loading" }}>
        <PeggedDollarPanel />
      </WalletContext.Provider>
    );

    expect(screen.getByRole("button", { name: "Wallet loading…" })).toBeDisabled();
  });

  it("uses deposit language when embedded on the Dollar page", () => {
    const onPendingChange = vi.fn();
    const { unmount } = render(
      <WalletContext.Provider value={{ ...defaultWalletState, status: "loading" }}>
        <PeggedDollarPanel embedded onPendingChange={onPendingChange} />
      </WalletContext.Provider>
    );

    expect(screen.getByRole("button", { name: "Deposit" })).toHaveAttribute("aria-pressed", "true");
    unmount();
    expect(onPendingChange).toHaveBeenCalledWith(false);
  });
});
