import { describe, expect, it } from "vitest";

import { getAddressExplorerUrl, readWalletEnvironment } from "@/lib/wallet-config";

describe("wallet environment", () => {
  it("uses Robinhood Testnet and its public RPC only for local development fallback", () => {
    const environment = readWalletEnvironment({});

    expect(environment.appEnvironment).toBe("development");
    expect(environment.network).toBe("robinhood-testnet");
    expect(environment.defaultChain.id).toBe(46_630);
    expect(environment.configured).toBe(false);
    expect(environment.supportedChains.map((chain) => chain.id)).toEqual([46_630, 31_337]);
  });

  it("accepts Anvil only for local development", () => {
    expect(readWalletEnvironment({ NEXT_PUBLIC_APP_NETWORK: "anvil" }).defaultChain.id).toBe(
      31_337
    );
    expect(() =>
      readWalletEnvironment({
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_APP_NETWORK: "anvil",
      })
    ).toThrow("Anvil is only available");
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
});
