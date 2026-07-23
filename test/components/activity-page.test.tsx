import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Hex } from "viem";

import { ActivityPage } from "@/components/dollar/ActivityPage";
import { writeDollarActivity } from "@/lib/dollar/activity";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

const wallet = "0x0000000000000000000000000000000000000001";
const originalHash: Hex = `0x${"11".repeat(32)}`;
const replacementHash: Hex = `0x${"22".repeat(32)}`;

function renderActivity(chainId: number) {
  return render(
    <WalletContext.Provider
      value={{
        ...defaultWalletState,
        status: "ready",
        authenticated: true,
        address: wallet,
        walletKind: "embedded",
        chainId,
        targetChainId: chainId,
        isTargetChain: true,
      }}
    >
      <ActivityPage />
    </WalletContext.Provider>
  );
}

describe("Dollar activity page", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows representative local preview states without wallet configuration", () => {
    render(
      <WalletContext.Provider value={defaultWalletState}>
        <ActivityPage />
      </WalletContext.Provider>
    );

    expect(screen.getByText("Sample activity data")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Protocol activity" })).toBeInTheDocument();
    expect(screen.getByText("Confirming")).toBeInTheDocument();
  });

  it("distinguishes a wallet rejection from an onchain revert", () => {
    writeDollarActivity({
      id: "rejected",
      wallet,
      chainId: 31_337,
      kind: "approve-weth",
      label: "Approve exact WETH",
      amount: "1",
      status: "rejected",
      error: "The wallet request was rejected.",
      createdAt: 1,
    });
    writeDollarActivity({
      id: "reverted",
      wallet,
      chainId: 31_337,
      kind: "deposit-eth",
      label: "Deposit ETH",
      amount: "1",
      status: "reverted",
      error: "The transaction reverted onchain.",
      createdAt: 2,
    });

    renderActivity(31_337);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Reverted")).toBeInTheDocument();
  });

  it("shows repriced confirmation metadata and a verified-chain explorer link", () => {
    writeDollarActivity({
      id: "repriced",
      wallet,
      chainId: 46_630,
      kind: "recombine-weth",
      label: "Recombine to WETH",
      amount: "1",
      status: "confirmed",
      hash: originalHash,
      replacementHash,
      confirmedHash: replacementHash,
      replacementReason: "repriced",
      createdAt: 1,
    });

    renderActivity(46_630);
    expect(screen.getByText("Confirmed · repriced")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /0x22222222/i })).toHaveAttribute(
      "href",
      `https://explorer.testnet.chain.robinhood.com/tx/${replacementHash}`
    );
    expect(screen.getByText(/Original transaction 0x11111111/)).toBeInTheDocument();
  });

  it("keeps local Anvil hashes inert", () => {
    writeDollarActivity({
      id: "local",
      wallet,
      chainId: 31_337,
      kind: "deposit-eth",
      label: "Deposit ETH",
      amount: "1",
      status: "confirmed",
      confirmedHash: originalHash,
      createdAt: 1,
    });

    renderActivity(31_337);
    expect(screen.getByTitle(originalHash).tagName).toBe("CODE");
    expect(screen.queryByRole("link", { name: /0x11111111/i })).not.toBeInTheDocument();
  });
});
