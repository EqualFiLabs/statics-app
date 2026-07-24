import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WalletPage } from "@/components/wallet/WalletPage";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

describe("wallet interactions", () => {
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
    fireEvent.click(screen.getByRole("tab", { name: /bridge/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
