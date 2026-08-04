import { describe, expect, it } from "vitest";

import {
  getAddressExplorerUrl,
  getAddressExplorerUrlForChain,
  getTransactionExplorerUrl,
  readWalletEnvironment,
} from "@/lib/wallet-config";

describe("wallet environment", () => {
  it("uses Robinhood Testnet and its public RPC only for local development fallback", () => {
    const environment = readWalletEnvironment({});

    expect(environment.appEnvironment).toBe("development");
    expect(environment.network).toBe("robinhood-testnet");
    expect(environment.defaultChain.id).toBe(46_630);
    expect(environment.configured).toBe(false);
    expect(environment.supportedChains.map((chain) => chain.id)).toEqual([46_630, 4_663, 31_337]);
  });

  it("accepts Anvil only for local development", () => {
    const environment = readWalletEnvironment({ NEXT_PUBLIC_APP_NETWORK: "anvil" });
    expect(environment.defaultChain.id).toBe(31_337);
    expect(environment.supportedChains.map((chain) => chain.id)).toEqual([31_337, 4_663, 46_630]);
    expect(() =>
      readWalletEnvironment({
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_APP_NETWORK: "anvil",
      })
    ).toThrow("Anvil is only available");
  });

  it("accepts Robinhood mainnet with an explicit production RPC", () => {
    const environment = readWalletEnvironment({
      NEXT_PUBLIC_APP_ENV: "production",
      NEXT_PUBLIC_APP_NETWORK: "robinhood",
      NEXT_PUBLIC_PRIVY_APP_ID: "app-id",
      NEXT_PUBLIC_ROBINHOOD_RPC_URL: "https://rpc.example",
    });

    expect(environment.defaultChain.id).toBe(4_663);
    expect(environment.supportedChains.map((chain) => chain.id)).toEqual([4_663]);
  });

  it("fails closed outside development when Privy or the RPC is absent", () => {
    expect(() => readWalletEnvironment({ NEXT_PUBLIC_APP_ENV: "production" })).toThrow(
      "NEXT_PUBLIC_PRIVY_APP_ID is required"
    );
    expect(() =>
      readWalletEnvironment({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_PRIVY_APP_ID: "app-id",
      })
    ).toThrow("NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL is required");
  });

  it("rejects credential-bearing public RPC URLs", () => {
    expect(() =>
      readWalletEnvironment({
        NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL: "https://user:secret@rpc.example",
      })
    ).toThrow("credential-free");
  });

  it("creates an address-specific Robinhood explorer link", () => {
    const environment = readWalletEnvironment({});
    expect(getAddressExplorerUrl(environment.defaultChain, "0x1234")).toBe(
      "https://explorer.testnet.chain.robinhood.com/address/0x1234"
    );
  });

  it("creates transaction links only for chains with a configured explorer", () => {
    expect(getTransactionExplorerUrl(46_630, "0x1234")).toBe(
      "https://explorer.testnet.chain.robinhood.com/tx/0x1234"
    );
    expect(getTransactionExplorerUrl(31_337, "0x1234")).toBeNull();
    expect(getTransactionExplorerUrl(4_663, "0x1234")).toBe(
      "https://robinhoodchain.blockscout.com/tx/0x1234"
    );
    expect(getAddressExplorerUrlForChain(46_630, "0x1234")).toBe(
      "https://explorer.testnet.chain.robinhood.com/address/0x1234"
    );
    expect(getAddressExplorerUrlForChain(31_337, "0x1234")).toBeNull();
  });
});
