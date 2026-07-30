import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("offers a local Anvil hash for copying rather than linking it", () => {
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
    // Anvil has no block explorer, so this must never become a link -- that is
    // the part of the original assertion worth keeping.
    expect(screen.queryByRole("link", { name: /0x11111111/i })).not.toBeInTheDocument();
    // But an unlinkable hash was previously unreachable: the full value existed
    // only in a tooltip, so there was no way to get it out of the page.
    expect(
      screen.getByRole("button", { name: `Copy transaction ${originalHash}` })
    ).toBeInTheDocument();
  });

  it("shows confirmed transactions whose resulting state still needs verification", () => {
    writeDollarActivity({
      id: "confirmed-unverified",
      wallet,
      chainId: 31_337,
      kind: "extend-loan",
      label: "Extend loan #23",
      amount: "2 extension fees",
      status: "confirmed-unverified",
      confirmedHash: originalHash,
      error: "Refresh before another action.",
      createdAt: 1,
    });

    renderActivity(31_337);
    expect(screen.getByText("Confirmed · refresh required")).toBeInTheDocument();
    expect(screen.getByText("Refresh before another action.")).toBeInTheDocument();
  });
});

describe("Dollar activity page across networks", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // Activity is a local record of what this wallet did, not a read scoped to a
  // chain. Being on the wrong network used to replace the whole list with a
  // switch-network prompt.
  it("renders while connected to a network the deployment does not target", () => {
    writeDollarActivity({
      id: "settled",
      wallet,
      chainId: 8_453,
      kind: "approve-weth",
      label: "Approve exact WETH",
      amount: "1",
      status: "confirmed",
      createdAt: 1,
    });

    render(
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "ready",
          authenticated: true,
          address: wallet,
          walletKind: "embedded",
          chainId: 1,
          targetChainId: 31_337,
          isTargetChain: false,
        }}
      >
        <ActivityPage />
      </WalletContext.Provider>
    );

    expect(screen.getByText("Approve exact WETH")).toBeInTheDocument();
    expect(screen.queryByText(/switch/i)).not.toBeInTheDocument();
  });

  // The chain is discovered from the storage key, so a record survives the
  // network being unconfigured rather than vanishing with it.
  it("shows a record from a chain that is not in the wallet's network list", () => {
    writeDollarActivity({
      id: "elsewhere",
      wallet,
      chainId: 42_161,
      kind: "approve-weth",
      label: "Arbitrum approval",
      amount: "1",
      status: "confirmed",
      createdAt: 2,
    });

    render(
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "ready",
          authenticated: true,
          address: wallet,
          walletKind: "embedded",
          chainId: 31_337,
          targetChainId: 31_337,
          isTargetChain: true,
        }}
      >
        <ActivityPage />
      </WalletContext.Provider>
    );

    expect(screen.getByText("Arbitrum approval")).toBeInTheDocument();
  });
});
