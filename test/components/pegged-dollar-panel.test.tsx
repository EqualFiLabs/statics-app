import { fireEvent, render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";

vi.mock("@privy-io/react-auth", () => ({
  useSignTypedData: () => ({ signTypedData: vi.fn() }),
}));

import { PeggedDollarPanel } from "@/components/portal/PeggedDollarPanel";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("pegged Dollar wallet states", () => {
  it("opens direct wallet connection before attempting a chain switch", () => {
    const connectWallet = vi.fn();
    const switchNetwork = vi.fn().mockResolvedValue(undefined);
    render(
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "disconnected",
          connectWallet,
          switchNetwork,
        }}
      >
        <PeggedDollarPanel />
      </WalletContext.Provider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(connectWallet).toHaveBeenCalledOnce();
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
