import type { ConnectedWallet } from "@privy-io/react-auth";
import { describe, expect, it } from "vitest";

import { selectActiveStaticsWallet, selectStaticsWallet } from "@/lib/wallet/selection";

function wallet({
  address,
  walletClientType,
  connectorType,
}: {
  address: `0x${string}`;
  walletClientType: string;
  connectorType: string;
}): ConnectedWallet {
  return {
    address,
    walletClientType,
    connectorType,
    imported: false,
  } as ConnectedWallet;
}

describe("Statics EVM wallet selection", () => {
  it("restores the embedded wallet even when a stale external wallet is listed first", () => {
    const external = wallet({
      address: "0x1111111111111111111111111111111111111111",
      walletClientType: "metamask",
      connectorType: "injected",
    });
    const embedded = wallet({
      address: "0x2222222222222222222222222222222222222222",
      walletClientType: "privy",
      connectorType: "embedded",
    });

    expect(selectStaticsWallet([external, embedded])).toBe(embedded);
  });

  it("keeps external-only users connected to their available wallet", () => {
    const external = wallet({
      address: "0x1111111111111111111111111111111111111111",
      walletClientType: "metamask",
      connectorType: "injected",
    });

    expect(selectStaticsWallet([external])).toBe(external);
    expect(selectStaticsWallet([])).toBeUndefined();
  });

  it("honors an external wallet explicitly activated through Privy", () => {
    const external = wallet({
      address: "0x1111111111111111111111111111111111111111",
      walletClientType: "metamask",
      connectorType: "injected",
    });
    const embedded = wallet({
      address: "0x2222222222222222222222222222222222222222",
      walletClientType: "privy",
      connectorType: "embedded",
    });

    expect(selectActiveStaticsWallet([embedded, external], external.address)).toBe(external);
  });

  it("falls back to the embedded wallet when the active external wallet is stale", () => {
    const embedded = wallet({
      address: "0x2222222222222222222222222222222222222222",
      walletClientType: "privy",
      connectorType: "embedded",
    });

    expect(
      selectActiveStaticsWallet([embedded], "0x1111111111111111111111111111111111111111")
    ).toBe(embedded);
  });
});
